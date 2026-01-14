"""
Local RAG Pipeline using Qwen3-VL-Embedding-8B + Qwen3-VL-Reranker-8B + FAISS

Based on official Qwen3-VL-Embedding repo:
https://github.com/QwenLM/Qwen3-VL-Embedding
"""
import json
import torch
import faiss
import numpy as np
from pathlib import Path

# Import from copied model files (from Qwen3-VL-Embedding repo)
from models.qwen3_vl_embedding import Qwen3VLEmbedder
from models.qwen3_vl_reranker import Qwen3VLReranker


class LocalRAGPipeline:
    """Embed -> Retrieve -> Rerank pipeline for FDAM methodology."""

    def __init__(self,
                 embedding_model: str = "Qwen/Qwen3-VL-Embedding-8B",
                 reranker_model: str = "Qwen/Qwen3-VL-Reranker-8B",
                 index_path: str = "/app/rag/fdam_index.faiss",
                 chunks_path: str = "/app/rag/fdam_chunks.json"):

        print("Loading Qwen3-VL-Embedding-8B...")
        self.embedder = Qwen3VLEmbedder(
            model_name_or_path=embedding_model,
            dtype=torch.bfloat16,
            # Note: Using default attention (SDPA on PyTorch 2.4+)
            # Per official RAG pattern: use concise task-specific instruction for queries
            default_instruction="Retrieve relevant passages for this query."
        )

        print("Loading Qwen3-VL-Reranker-8B...")
        self.reranker = Qwen3VLReranker(
            model_name_or_path=reranker_model,
            dtype=torch.bfloat16,
            # Note: Using default attention (SDPA on PyTorch 2.4+)
            # Per official RAG pattern: use concise task-specific instruction for reranking
            default_instruction="Retrieve relevant passages for this query."
        )

        # Load FAISS index and chunks (build if missing)
        self.index_path = index_path
        self.chunks_path = chunks_path

        if not Path(index_path).exists() or not Path(chunks_path).exists():
            print("FAISS index not found - building from RAG-KB documents...")
            self._build_index()
        else:
            print(f"Loading FAISS index from {index_path}...")
            self.index = faiss.read_index(index_path)
            with open(chunks_path, 'r') as f:
                self.chunks = json.load(f)
        print(f"Loaded {len(self.chunks)} chunks")

    def _build_index(self, docs_dir: str = "/app/RAG-KB"):
        """Build FAISS index from documents using the loaded embedder."""
        from pathlib import Path

        # Document hierarchy - FDAM methodology is authoritative
        PRIMARY_DOCS = ["FDAM_v4_METHODOLOGY.md"]

        def chunk_document(text: str, source: str, chunk_size: int = 400, overlap: int = 50) -> list:
            words = text.split()
            chunks = []
            doc_type = "primary" if source in PRIMARY_DOCS else "reference"
            for i in range(0, len(words), chunk_size - overlap):
                chunk_words = words[i:i + chunk_size]
                chunk_text = " ".join(chunk_words)
                chunks.append({
                    "text": chunk_text,
                    "source": source,
                    "start_idx": i,
                    "doc_type": doc_type
                })
            return chunks

        # Collect all chunks from markdown files
        all_chunks = []
        docs_path = Path(docs_dir)
        for md_file in docs_path.glob("*.md"):
            print(f"Processing: {md_file.name}")
            text = md_file.read_text()
            chunks = chunk_document(text, md_file.name)
            all_chunks.extend(chunks)

        print(f"Total chunks: {len(all_chunks)}")

        if len(all_chunks) == 0:
            raise RuntimeError("No chunks found. Check that RAG-KB/ contains .md files.")

        # Embed all chunks in batches (use loaded embedder, no instruction for documents)
        embeddings = []
        batch_size = 4
        for i in range(0, len(all_chunks), batch_size):
            batch = all_chunks[i:i + batch_size]
            inputs = [{"text": c["text"]} for c in batch]
            batch_embeddings = self.embedder.process(inputs)
            embeddings.append(batch_embeddings.cpu().float().numpy())  # Convert bfloat16 → float32
            print(f"Embedded {min(i + batch_size, len(all_chunks))}/{len(all_chunks)}")

        embeddings_array = np.vstack(embeddings).astype('float32')

        # Build FAISS index (Inner Product for normalized vectors = cosine similarity)
        dimension = embeddings_array.shape[1]
        self.index = faiss.IndexFlatIP(dimension)
        self.index.add(embeddings_array)
        self.chunks = all_chunks

        # Save index and chunks for next startup
        output_path = Path(self.index_path).parent
        output_path.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, str(self.index_path))
        with open(self.chunks_path, 'w') as f:
            json.dump(all_chunks, f, indent=2)

        print(f"Index saved: {self.index.ntotal} vectors of dimension {dimension}")

    def embed_texts(self, texts: list, instruction: str = None) -> np.ndarray:
        """Embed list of texts using Qwen3VLEmbedder."""
        inputs = [{"text": t, "instruction": instruction} for t in texts]
        embeddings = self.embedder.process(inputs)
        return embeddings.cpu().float().numpy()  # Convert bfloat16 → float32

    def retrieve(self, query: str, top_k: int = 20) -> list:
        """Retrieve top-k chunks from FAISS index."""
        # Embed query with task-specific instruction
        query_embedding = self.embed_texts(
            [query],
            instruction="Retrieve relevant passages for this query."
        )

        # Search FAISS
        distances, indices = self.index.search(query_embedding, top_k)

        results = []
        for i, idx in enumerate(indices[0]):
            # FAISS returns -1 for invalid indices when there aren't enough results
            if idx >= 0 and idx < len(self.chunks):
                results.append({
                    "chunk": self.chunks[idx],
                    "score": float(distances[0][i])
                })
        return results

    def rerank(self, query: str, candidates: list, top_k: int = 5) -> list:
        """Rerank candidates using Qwen3VLReranker."""
        if not candidates:
            return []

        # Format for reranker with task-specific instruction
        inputs = {
            "instruction": "Retrieve relevant passages for this query.",
            "query": {"text": query},
            "documents": [{"text": c["chunk"]["text"]} for c in candidates]
        }

        # Get rerank scores
        scores = self.reranker.process(inputs)

        # Attach scores and sort
        for i, score in enumerate(scores):
            candidates[i]["rerank_score"] = score

        candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
        return candidates[:top_k]

    def search(self, query: str, top_k: int = 5) -> str:
        """Full RAG pipeline: embed -> retrieve -> rerank -> format."""
        # Retrieve top-20 candidates
        candidates = self.retrieve(query, top_k=20)

        # Rerank to top-5
        reranked = self.rerank(query, candidates, top_k=top_k)

        # Format results with source hierarchy labels
        formatted = []
        for item in reranked:
            chunk = item["chunk"]
            source = chunk.get("source", "unknown")
            text = chunk.get("text", "")
            score = item.get("rerank_score", 0)
            doc_type = chunk.get("doc_type", "reference")
            label = "[FDAM]" if doc_type == "primary" else "[Reference]"
            formatted.append(f"{label} {source} (relevance: {score:.2f})\n{text}")

        return "\n\n---\n\n".join(formatted) if formatted else "No relevant methodology found."


# Global instance (initialized once at startup)
_rag_pipeline = None


def get_rag_pipeline() -> LocalRAGPipeline:
    global _rag_pipeline
    if _rag_pipeline is None:
        _rag_pipeline = LocalRAGPipeline()
    return _rag_pipeline
