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
            torch_dtype=torch.bfloat16,
            # Note: Using default attention (SDPA on PyTorch 2.4+)
            # flash_attention_2 requires separate installation
            default_instruction="Retrieve fire damage assessment methodology information."
        )

        print("Loading Qwen3-VL-Reranker-8B...")
        self.reranker = Qwen3VLReranker(
            model_name_or_path=reranker_model,
            torch_dtype=torch.bfloat16,
            # Note: Using default attention (SDPA on PyTorch 2.4+)
            default_instruction="Given a fire damage query, retrieve relevant FDAM methodology."
        )

        # Load FAISS index and chunks
        print(f"Loading FAISS index from {index_path}...")
        self.index = faiss.read_index(index_path)
        with open(chunks_path, 'r') as f:
            self.chunks = json.load(f)
        print(f"Loaded {len(self.chunks)} chunks")

    def embed_texts(self, texts: list, instruction: str = None) -> np.ndarray:
        """Embed list of texts using Qwen3VLEmbedder."""
        inputs = [{"text": t, "instruction": instruction} for t in texts]
        embeddings = self.embedder.process(inputs)
        return embeddings.cpu().numpy().astype('float32')

    def retrieve(self, query: str, top_k: int = 20) -> list:
        """Retrieve top-k chunks from FAISS index."""
        # Embed query
        query_embedding = self.embed_texts(
            [query],
            instruction="Retrieve fire damage assessment methodology information."
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

        # Format for reranker
        inputs = {
            "instruction": "Given a fire damage query, retrieve relevant FDAM methodology.",
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

        # Format results
        formatted = []
        for item in reranked:
            chunk = item["chunk"]
            source = chunk.get("source", "FDAM")
            text = chunk.get("text", "")
            score = item.get("rerank_score", 0)
            formatted.append(f"[{source}] (relevance: {score:.2f})\n{text}")

        return "\n\n---\n\n".join(formatted) if formatted else "No relevant methodology found."


# Global instance (initialized once at startup)
_rag_pipeline = None


def get_rag_pipeline() -> LocalRAGPipeline:
    global _rag_pipeline
    if _rag_pipeline is None:
        _rag_pipeline = LocalRAGPipeline()
    return _rag_pipeline
