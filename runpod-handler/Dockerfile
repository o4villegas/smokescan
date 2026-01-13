# SmokeScan RunPod Handler - Qwen3-VL Vision Model with Agent Support
# Uses vLLM for OpenAI-compatible API + qwen-agent for tool calling
#
# Based on official Qwen3-VL requirements:
# https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV VLLM_PORT=8000

# Install vLLM (provides OpenAI-compatible API server)
# NOTE: vLLM must be installed first as it has specific CUDA requirements
RUN pip install --no-cache-dir vllm>=0.6.0

# Install transformers 4.57.3 (latest stable with Qwen3-VL support)
# NOTE: Do NOT use git HEAD - it has tensor shape regression for expert layers
# NOTE: 4.57.0 was yanked from PyPI
RUN pip uninstall -y transformers 2>/dev/null || true && \
    pip install --no-cache-dir transformers==4.57.3

# Install qwen-agent for tool calling support
RUN pip install --no-cache-dir qwen-agent

# Install other required packages
RUN pip install --no-cache-dir \
    accelerate>=0.34.0 \
    pillow \
    runpod \
    sentencepiece \
    protobuf \
    qwen-vl-utils \
    einops \
    tiktoken \
    requests

# Verify installations
RUN python -c "import transformers; print(f'Transformers: {transformers.__version__}')"
RUN python -c "import vllm; print(f'vLLM: {vllm.__version__}')"
RUN python -c "import qwen_agent; print('qwen-agent: OK')"
RUN python -c "from qwen_agent.tools.base import BaseTool, register_tool; print('qwen-agent tools: OK')"

# Create working directory
WORKDIR /app

# Copy tools directory (must be before handler for imports)
COPY tools/ /app/tools/

# Copy handler and startup script
COPY handler.py /app/handler.py
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Set the entrypoint to startup script
CMD ["/app/start.sh"]
