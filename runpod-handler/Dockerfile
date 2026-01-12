# SmokeScan RunPod Handler - Qwen3-VL Vision Model
# Uses Transformers for maximum compatibility with latest models

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
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.10 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1
RUN update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# Upgrade pip
RUN pip install --upgrade pip

# Install PyTorch with CUDA 12.1 support
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install Transformers and related packages (latest versions for Qwen3-VL support)
RUN pip install \
    transformers>=4.45.0 \
    accelerate>=0.34.0 \
    flash-attn>=2.6.0 --no-build-isolation \
    pillow \
    runpod \
    sentencepiece \
    protobuf \
    qwen-vl-utils

# Create working directory
WORKDIR /app

# Copy handler
COPY handler.py /app/handler.py

# Set the entrypoint
CMD ["python", "-u", "handler.py"]
