# SmokeScan RunPod Handler - Qwen3-VL Vision Model
# Uses Transformers for maximum compatibility with latest models
#
# Based on official Qwen3-VL requirements:
# https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking

FROM nvidia/cuda:12.1.0-cudnn8-devel-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/runpod-volume/huggingface
ENV TRANSFORMERS_CACHE=/runpod-volume/huggingface
ENV MODEL_NAME=Qwen/Qwen3-VL-30B-A3B-Thinking

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    python3.10-venv \
    python3.10-dev \
    git \
    wget \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.10 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1
RUN update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# Upgrade pip
RUN pip install --upgrade pip setuptools wheel

# Install PyTorch with CUDA 12.1 support
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install Transformers from source (required for Qwen3VLMoeForConditionalGeneration)
# Qwen3-VL-MoE requires transformers >= 4.57.0
RUN pip install git+https://github.com/huggingface/transformers.git

# Install other required packages
RUN pip install \
    accelerate>=0.34.0 \
    pillow \
    runpod \
    sentencepiece \
    protobuf \
    qwen-vl-utils \
    einops \
    tiktoken

# Optional: Flash Attention 2 for better performance (may fail on some systems)
RUN pip install flash-attn --no-build-isolation || echo "Flash Attention installation failed, continuing without it"

# Create working directory
WORKDIR /app

# Copy handler
COPY handler.py /app/handler.py

# Set the entrypoint
CMD ["python", "-u", "handler.py"]
