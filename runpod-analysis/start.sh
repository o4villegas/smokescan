#!/bin/bash
# SmokeScan Analysis Endpoint - vLLM + Handler startup
# Serves Qwen3-VL-30B-A3B-Thinking for vision reasoning

set -e

echo "=========================================="
echo "SmokeScan Analysis Endpoint Starting..."
echo "=========================================="

# Configuration
VLLM_PORT=8000
MAX_RETRIES=60
RETRY_INTERVAL=5

# Find cached model or use HuggingFace
MODEL_PATH="Qwen/Qwen3-VL-30B-A3B-Thinking"

# Check RunPod volume cache first
CACHE_DIR="/runpod-volume/huggingface-cache/hub/models--Qwen--Qwen3-VL-30B-A3B-Thinking"
if [ -d "$CACHE_DIR" ]; then
    SNAPSHOT=$(ls "$CACHE_DIR/snapshots/" 2>/dev/null | head -1)
    if [ -n "$SNAPSHOT" ]; then
        MODEL_PATH="$CACHE_DIR/snapshots/$SNAPSHOT"
        echo "Using cached model: $MODEL_PATH"
    fi
else
    echo "Model not cached, will download from HuggingFace: $MODEL_PATH"
fi

# Start vLLM server with higher GPU utilization (no competing models)
echo "Starting vLLM server..."
python -m vllm.entrypoints.openai.api_server \
    --model "$MODEL_PATH" \
    --served-model-name qwen3-vl \
    --port $VLLM_PORT \
    --trust-remote-code \
    --dtype auto \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.85 &

VLLM_PID=$!
echo "vLLM server PID: $VLLM_PID"

# Wait for vLLM server to be ready
echo "Waiting for vLLM server to be ready..."
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s "http://localhost:$VLLM_PORT/health" > /dev/null 2>&1; then
        echo "vLLM server is ready!"
        break
    fi

    # Check if vLLM process is still running
    if ! kill -0 $VLLM_PID 2>/dev/null; then
        echo "ERROR: vLLM server process died!"
        exit 1
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "  Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep $RETRY_INTERVAL
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: vLLM server failed to start within timeout"
    exit 1
fi

# Start the handler
echo "Starting Analysis handler..."
exec python -u /app/handler.py
