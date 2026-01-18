# SmokeScan Analysis Endpoint - Two-Pass Transformers
# Direct Qwen3-VL-32B-Instruct inference with contextual RAG
# No vLLM - uses transformers directly (proven pattern from HF space)

# Use explicit CUDA 12.4.1 base (proven working with RunPod)
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install dependencies from requirements.txt
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install flash-attention (requires special build flags)
# This significantly improves multi-image performance
RUN pip install flash-attn --no-build-isolation

# Verify critical dependencies
RUN python -c "import transformers; print(f'transformers: {transformers.__version__}')"
RUN python -c "import torch; print(f'torch: {torch.__version__}')"
RUN python -c "import accelerate; print(f'accelerate: {accelerate.__version__}')"

# Copy handler and startup script
COPY handler.py /app/handler.py
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Entry point runs handler directly (model loads at startup)
CMD ["/app/start.sh"]
