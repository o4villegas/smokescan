"""
SmokeScan Retrieval Endpoint - Embedding + Reranking only
No vLLM, no vision model - just RAG pipeline

This endpoint handles FDAM methodology retrieval using:
- Qwen3-VL-Embedding-8B for dense retrieval
- FAISS index for similarity search
- Qwen3-VL-Reranker-8B for reranking

Input: {"queries": ["query1", "query2"], "top_k": 5}
Output: {"results": [{"query": "...", "chunks": [...]}]}
"""
import runpod
import sys

print("SmokeScan Retrieval Handler - Starting initialization...")
print(f"Python version: {sys.version}")

# Import and initialize RAG pipeline (loads embedding + reranker models)
from rag.pipeline import get_rag_pipeline

print("Preloading RAG pipeline (embedding + reranker models)...")
rag = get_rag_pipeline()
print(f"RAG pipeline ready: {len(rag.chunks)} chunks indexed")


def handler(job):
    """
    Process RAG retrieval requests.

    Input format:
    {
        "queries": ["query1", "query2", ...],  # List of search queries
        "top_k": 5                              # Number of results per query
    }

    Output format:
    {
        "output": {
            "results": [
                {
                    "query": "query1",
                    "chunks": [
                        {"text": "...", "source": "...", "score": 0.95},
                        ...
                    ]
                },
                ...
            ]
        }
    }
    """
    try:
        job_input = job["input"]
        queries = job_input.get("queries", [])
        top_k = job_input.get("top_k", 5)

        if not queries:
            return {"error": "No queries provided"}

        if not isinstance(queries, list):
            queries = [queries]

        print(f"Processing {len(queries)} queries with top_k={top_k}")

        results = []
        for query in queries:
            # Search returns formatted string, but we need structured data
            # Use the underlying search method to get structured results
            chunks = rag.search(query, top_k=top_k)
            results.append({
                "query": query,
                "chunks": chunks
            })
            print(f"  Query '{query[:50]}...' -> {len(chunks) if isinstance(chunks, list) else 'formatted'} results")

        return {
            "output": {
                "results": results
            }
        }

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Handler error: {e}\n{error_trace}")
        return {
            "error": str(e),
            "traceback": error_trace
        }


print("Retrieval Handler initialized - waiting for requests...")
runpod.serverless.start({"handler": handler})
