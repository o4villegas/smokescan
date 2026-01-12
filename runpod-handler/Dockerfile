# SmokeScan RunPod Handler - Qwen3-VL Vision Model
# Uses RunPod's official base image (PyTorch + CUDA pre-installed)
#
# Based on official Qwen3-VL requirements:
# https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/runpod-volume/huggingface
ENV TRANSFORMERS_CACHE=/runpod-volume/huggingface

# Install Transformers from source (required for Qwen3VLMoeForConditionalGeneration)
# Qwen3-VL-MoE requires transformers >= 4.57.0
RUN pip install --no-cache-dir git+https://github.com/huggingface/transformers.git

# Install other required packages
RUN pip install --no-cache-dir \
    accelerate>=0.34.0 \
    pillow \
    runpod \
    sentencepiece \
    protobuf \
    qwen-vl-utils \
    einops \
    tiktoken

# Create working directory
WORKDIR /app

# Copy handler
COPY handler.py /app/handler.py

# Set the entrypoint
CMD ["python", "-u", "handler.py"]
