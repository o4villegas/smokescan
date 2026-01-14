"""
Build FAISS index from FDAM documents at container startup.
Uses Qwen3VLEmbedder from official repo.

Run with: python /app/rag/build_index.py
"""
import json
import sys
import torch
import faiss
import numpy as np
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, '/app')

from models.qwen3_vl_embedding import Qwen3VLEmbedder

# Document hierarchy - FDAM methodology is authoritative, others are supporting references
PRIMARY_DOCS = ["FDAM_v4_METHODOLOGY.md"]


def chunk_document(text: str, source: str, chunk_size: int = 400, overlap: int = 50) -> list:
    """Split document into overlapping chunks with source type metadata."""
    words = text.split()
    chunks = []

    # Determine document type for source hierarchy
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


def build_index(
    docs_dir: str = "/app/RAG-KB",
    output_dir: str = "/app/rag",
    model_name: str = "Qwen/Qwen3-VL-Embedding-8B"
):
    """Build FAISS index from markdown documents."""

    # Load embedding model using official Qwen3VLEmbedder
    # Per official RAG example: documents use default instruction ("Represent the user's input.")
    print(f"Loading embedding model: {model_name}")
    embedder = Qwen3VLEmbedder(
        model_name_or_path=model_name,
        dtype=torch.bfloat16,
        # Note: Using default attention (SDPA on PyTorch 2.4+)
        # No custom instruction for documents - per official Qwen3-VL-Embedding RAG pattern
    )

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
        print("ERROR: No chunks found. Check that RAG-KB/ contains .md files.")
        sys.exit(1)

    # Embed all chunks in batches
    embeddings = []
    batch_size = 4  # Smaller batch for 8B model

    for i in range(0, len(all_chunks), batch_size):
        batch = all_chunks[i:i + batch_size]

        # Format for Qwen3VLEmbedder
        inputs = [{"text": c["text"]} for c in batch]

        # Get embeddings (returns normalized by default)
        batch_embeddings = embedder.process(inputs)
        embeddings.append(batch_embeddings.cpu().float().numpy())  # Convert bfloat16 → float32

        print(f"Embedded {min(i + batch_size, len(all_chunks))}/{len(all_chunks)}")

    embeddings = np.vstack(embeddings).astype('float32')

    # Build FAISS index (Inner Product for normalized vectors = cosine similarity)
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)

    # Save index and chunks
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    faiss.write_index(index, str(output_path / "fdam_index.faiss"))
    with open(output_path / "fdam_chunks.json", 'w') as f:
        json.dump(all_chunks, f, indent=2)

    print(f"Index saved to {output_dir}")
    print(f"Index contains {index.ntotal} vectors of dimension {dimension}")

    # Clear GPU memory so vLLM can allocate cleanly
    del embedder
    torch.cuda.empty_cache()
    print("GPU memory cleared")


if __name__ == "__main__":
    build_index()
