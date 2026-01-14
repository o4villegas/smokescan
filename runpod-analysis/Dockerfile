# SmokeScan Analysis Endpoint
# Vision reasoning only (~40GB VRAM on A100)
# Uses vLLM to serve Qwen3-VL-30B-A3B-Thinking
# NO embedding or reranking models - receives pre-fetched RAG context

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install vLLM + dependencies (NO embedding/reranker models)
# CRITICAL: transformers==4.57.3 is required for Qwen3-VL models
RUN pip install --no-cache-dir \
    vllm>=0.6.0 \
    transformers==4.57.3 \
    openai \
    runpod \
    qwen-vl-utils>=0.0.14 \
    accelerate>=0.34.0

# Verify critical dependencies
RUN python -c "import transformers; print(f'transformers: {transformers.__version__}')"
RUN python -c "import vllm; print('vLLM available')"

# Copy handler and startup script
COPY handler.py /app/handler.py
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Entry point runs vLLM server then handler
CMD ["/app/start.sh"]
