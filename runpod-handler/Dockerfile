# SmokeScan RunPod Handler - Qwen3-VL Vision Model
# Uses RunPod's official base image (PyTorch + CUDA pre-installed)
#
# Based on official Qwen3-VL requirements:
# https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

# Set environment variables
ENV PYTHONUNBUFFERED=1
# REMOVED: HF_HOME and TRANSFORMERS_CACHE pointing to /runpod-volume/
# Let HuggingFace use default cache OR RunPod's model caching system

# Uninstall any existing transformers to avoid conflicts
# Then install from git HEAD (required for Qwen3VLMoeForConditionalGeneration)
# See: https://github.com/huggingface/transformers/issues/41447
RUN pip uninstall -y transformers 2>/dev/null || true && \
    pip install --no-cache-dir --force-reinstall \
    git+https://github.com/huggingface/transformers.git

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

# Verify transformers version and model class availability
RUN python -c "import transformers; print(f'Transformers: {transformers.__version__}'); from transformers import Qwen3VLMoeForConditionalGeneration; print('Model class import OK')"

# Create working directory
WORKDIR /app

# Copy handler
COPY handler.py /app/handler.py

# Set the entrypoint
CMD ["python", "-u", "handler.py"]
