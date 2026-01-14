#!/bin/bash
# SmokeScan Retrieval Endpoint - Simple startup
# No vLLM server needed - just run the handler directly

set -e

echo "=========================================="
echo "SmokeScan Retrieval Endpoint Starting..."
echo "=========================================="

# Check if FAISS index exists (should be pre-built in Docker image)
if [ -f "/app/rag/fdam_index.faiss" ]; then
    echo "FAISS index found (pre-built)"
else
    echo "Building FAISS index..."
    python /app/rag/build_index.py
fi

echo "Starting handler..."
exec python -u /app/handler.py
