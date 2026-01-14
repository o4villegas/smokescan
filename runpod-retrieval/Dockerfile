# SmokeScan Retrieval Endpoint
# Embedding + Reranking only (~32GB VRAM on A40)
# NO vLLM - just RAG pipeline with Qwen3-VL-Embedding-8B + Qwen3-VL-Reranker-8B

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install dependencies (NO vLLM needed - saves space and startup time)
# CRITICAL: transformers==4.57.3 is required for Qwen3-VL models
RUN pip install --no-cache-dir \
    transformers==4.57.3 \
    faiss-gpu-cu12 \
    torch \
    accelerate>=0.34.0 \
    qwen-vl-utils>=0.0.14 \
    runpod \
    pillow \
    sentencepiece \
    protobuf \
    einops \
    tiktoken \
    scipy

# Install huggingface-cli for model downloads
RUN pip install --no-cache-dir huggingface_hub

# Verify critical dependencies
RUN python -c "import transformers; print(f'transformers: {transformers.__version__}')"
RUN python -c "import faiss; print('FAISS available')"

# Pre-download models at build time (prevents runtime download failures)
# These models are ~8B parameters each, total ~16GB download
ENV HF_HOME=/root/.cache/huggingface
RUN echo "Downloading Qwen3-VL-Embedding-8B..." && \
    huggingface-cli download Qwen/Qwen3-VL-Embedding-8B --local-dir-use-symlinks False
RUN echo "Downloading Qwen3-VL-Reranker-8B..." && \
    huggingface-cli download Qwen/Qwen3-VL-Reranker-8B --local-dir-use-symlinks False

# Copy RAG pipeline code
COPY rag/ /app/rag/

# Copy model wrappers
COPY models/ /app/models/

# Copy knowledge base documents
COPY RAG-KB/ /app/RAG-KB/

# NOTE: FAISS index is built at container runtime, not build time
# This is necessary because:
# 1. GPU access during Docker build is unreliable
# 2. Index builds quickly (~2-3 min) with GPU on RunPod
# 3. Index persists to /app/rag/ and survives container restarts

# Copy handler
COPY handler.py /app/handler.py

# Run handler directly (no vLLM server needed)
CMD ["python", "-u", "/app/handler.py"]
