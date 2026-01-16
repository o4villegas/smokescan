# SmokeScan Analysis Endpoint - Qwen-Agent with FDAM RAG Tool
# Vision reasoning with dynamic RAG retrieval (~40GB VRAM on A100)
# Uses vLLM to serve Qwen3-VL-30B-A3B-Thinking
# Qwen-Agent framework enables tool calling for FDAM methodology retrieval

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install vLLM + qwen-agent + dependencies
# CRITICAL: transformers==4.57.3 is required for Qwen3-VL models
RUN pip install --no-cache-dir \
    vllm>=0.6.0 \
    transformers==4.57.3 \
    qwen-agent \
    openai \
    runpod \
    requests \
    json5 \
    qwen-vl-utils>=0.0.14 \
    accelerate>=0.34.0

# Verify critical dependencies
RUN python -c "import transformers; print(f'transformers: {transformers.__version__}')"
RUN python -c "import vllm; print('vLLM available')"
RUN python -c "import qwen_agent; print('qwen-agent available')"

# Copy tools directory (custom FDAM RAG tool)
COPY tools/ /app/tools/

# Copy handler and startup script
COPY handler.py /app/handler.py
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Entry point runs vLLM server then handler
CMD ["/app/start.sh"]
