#!/bin/bash
# SmokeScan Analysis Endpoint - Two-Pass Transformers
# Direct Qwen3-VL-30B-A3B-Instruct inference (no vLLM)

set -e

# Redirect all output to log file AND console for debugging
if [ -d "/runpod-volume" ]; then
    exec > >(tee -a /runpod-volume/startup.log) 2>&1
    echo ""
    echo "========================================"
    echo "NEW STARTUP: $(date -Iseconds)"
    echo "========================================"
fi

echo "=========================================="
echo "SmokeScan Analysis - Two-Pass Transformers"
echo "Model: Qwen3-VL-32B-Instruct (Dense)"
echo "=========================================="

# Point HuggingFace cache to network volume (persistent storage)
# This prevents "No space left on device" errors - model is ~60GB
if [ -d "/runpod-volume" ]; then
    export HF_HOME="/runpod-volume/huggingface-cache"
    mkdir -p "$HF_HOME"
    echo "HuggingFace cache: $HF_HOME"
fi

# Set multiprocessing method for CUDA compatibility
export VLLM_WORKER_MULTIPROC_METHOD=spawn
echo "Multiprocess method: spawn"

# Run handler directly (model loads at startup via load_model())
echo "Starting handler..."
exec python -u /app/handler.py
