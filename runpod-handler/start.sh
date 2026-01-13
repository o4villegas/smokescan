#!/bin/bash
# SmokeScan RunPod Startup Script
# Starts vLLM server for vision, builds FAISS index, then runs handler
# Handler preloads embedding/reranker models before accepting requests

set -e

MODEL_NAME="Qwen/Qwen3-VL-30B-A3B-Thinking"
RUNPOD_CACHE_DIR="/runpod-volume/huggingface-cache/hub"
VLLM_PORT=8000

echo "=== SmokeScan Vision Server Startup ==="

# Find cached model path (RunPod cache structure)
find_cached_model() {
    cache_name=$(echo "$MODEL_NAME" | sed 's/\//-/g')
    snapshots_dir="$RUNPOD_CACHE_DIR/models--$cache_name/snapshots"

    if [ -d "$snapshots_dir" ]; then
        first_snapshot=$(ls "$snapshots_dir" 2>/dev/null | head -1)
        if [ -n "$first_snapshot" ]; then
            echo "$snapshots_dir/$first_snapshot"
            return 0
        fi
    fi
    echo ""
    return 1
}

# Determine model path
MODEL_PATH=$(find_cached_model)
if [ -n "$MODEL_PATH" ]; then
    echo "Using RunPod cached model at: $MODEL_PATH"
else
    echo "No RunPod cache found - vLLM will download from HuggingFace: $MODEL_NAME"
    MODEL_PATH="$MODEL_NAME"
fi

# Build FAISS index if not exists
if [ ! -f "/app/rag/fdam_index.faiss" ]; then
    echo "Building FAISS index from FDAM documents..."
    python /app/rag/build_index.py
    echo "FAISS index built successfully!"
else
    echo "FAISS index already exists, skipping build"
fi

# Start vLLM server in background
echo "Starting vLLM server on port $VLLM_PORT..."
python -m vllm.entrypoints.openai.api_server \
    --model "$MODEL_PATH" \
    --served-model-name "qwen3-vl" \
    --port $VLLM_PORT \
    --trust-remote-code \
    --dtype auto \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.35 \
    &

# NOTE: gpu-memory-utilization set to 0.35 (~28GB) to leave room for:
# - Qwen3-VL-Embedding-8B (~16GB)
# - Qwen3-VL-Reranker-8B (~16GB)
# - FAISS index (~2GB)

VLLM_PID=$!
echo "vLLM server started with PID: $VLLM_PID"

# Wait for vLLM to be ready
echo "Waiting for vLLM server to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s "http://localhost:$VLLM_PORT/health" > /dev/null 2>&1; then
        echo "vLLM server is ready!"
        break
    fi

    # Check if vLLM process is still running
    if ! kill -0 $VLLM_PID 2>/dev/null; then
        echo "ERROR: vLLM server process died unexpectedly"
        exit 1
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for vLLM... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: vLLM server failed to start within timeout"
    exit 1
fi

# Start the RunPod handler
# Handler will preload embedding/reranker models before accepting requests
echo "Starting RunPod handler (will preload RAG pipeline)..."
exec python -u /app/handler.py
