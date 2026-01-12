# SmokeScan RunPod Handler

Custom RunPod serverless handler for Qwen3-VL vision model using Transformers.

## Why Custom Handler?

RunPod's pre-built vLLM templates don't support the latest `qwen3_vl_moe` architecture. This handler uses Transformers directly for maximum compatibility.

## Files

- `handler.py` - RunPod serverless handler with Qwen3-VL support
- `Dockerfile` - Container definition with CUDA 12.1 + Transformers

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_NAME` | `Qwen/Qwen3-VL-30B-A3B-Thinking` | HuggingFace model ID |
| `HF_TOKEN` | - | HuggingFace token (if model is gated) |

## Deployment Options

### Option 1: GitHub Integration
1. Push this directory to GitHub
2. In RunPod, create new endpoint with GitHub repo
3. Point to this `runpod-handler` directory

### Option 2: Docker Hub
1. Build: `docker build -t yourusername/smokescan-vision:latest .`
2. Push: `docker push yourusername/smokescan-vision:latest`
3. Create RunPod template with this image

## API Format

Request (OpenAI-compatible):
```json
{
  "input": {
    "messages": [
      {"role": "system", "content": "You are a fire damage assessment expert."},
      {"role": "user", "content": [
        {"type": "text", "text": "Analyze this fire damage image."},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
      ]}
    ],
    "sampling_params": {
      "max_tokens": 2000,
      "temperature": 0.1
    }
  }
}
```

Response:
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Based on the image analysis..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 500,
    "total_tokens": 650
  }
}
```
