# SmokeScan RunPod Handler

Qwen3-VL agent with RAG tool calling for FDAM fire damage assessment.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  RunPod Container                                                   │
│  ┌──────────────────────────┐    ┌────────────────────────────┐   │
│  │  vLLM Server             │◄───│  qwen-agent Assistant      │   │
│  │  (OpenAI-compatible API) │    │  with rag_search tool      │   │
│  │  localhost:8000          │    └────────────────────────────┘   │
│  └──────────────────────────┘              │                       │
│                                            │ Tool Call             │
│                                            ▼                       │
│                               ┌────────────────────────────┐       │
│                               │  Cloudflare AI Search      │       │
│                               │  REST API                  │       │
│                               │  (FDAM methodology)        │       │
│                               └────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

The agent:
1. Analyzes fire damage images using Qwen3-VL vision capabilities
2. Calls `rag_search` tool to retrieve relevant FDAM methodology
3. Generates grounded assessment reports with methodology citations

## Files

- `handler.py` - RunPod serverless handler using qwen-agent
- `start.sh` - Startup script (starts vLLM server, then handler)
- `Dockerfile` - Container with vLLM + qwen-agent + transformers
- `tools/` - Custom tools for the agent
  - `rag_search.py` - Cloudflare AI Search REST API integration

## Environment Variables

### Required for RAG Tool

| Variable | Description |
|----------|-------------|
| `CF_AUTORAG_TOKEN` | Cloudflare AI Search API token |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |
| `CF_RAG_NAME` | AI Search instance name (default: `smokescan-rag`) |

### Model Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_NAME` | `Qwen/Qwen3-VL-30B-A3B-Thinking` | HuggingFace model ID |

## Deployment

### Option 1: Docker Hub
```bash
# Build
docker build -t yourusername/smokescan-vision:latest .

# Push
docker push yourusername/smokescan-vision:latest

# Create RunPod template with this image
```

### Option 2: GitHub Integration
1. Push to GitHub
2. Create RunPod endpoint with GitHub repo
3. Point to `runpod-handler` directory

### RunPod Environment Setup
In RunPod Dashboard, add secrets:
- `CF_AUTORAG_TOKEN` - Your Cloudflare AI Search API token
- `CF_ACCOUNT_ID` - Your Cloudflare Account ID

## API Format

### Assessment Request
```json
{
  "input": {
    "messages": [
      {"role": "user", "content": [
        {"type": "text", "text": "Analyze these images of a residential-kitchen in a single-family structure."},
        {"type": "image", "image": "data:image/jpeg;base64,..."}
      ]}
    ],
    "max_tokens": 8000
  }
}
```

### Chat Request (with session context)
```json
{
  "input": {
    "messages": [
      {"role": "user", "content": "What cleaning method should be used for the ceiling?"}
    ],
    "session_context": "## Assessment Summary\n- Room Type: residential-kitchen\n...",
    "max_tokens": 4000
  }
}
```

### Response
```json
{
  "output": "Based on the image analysis and FDAM methodology..."
}
```

## Testing the RAG Tool

Test Cloudflare AI Search REST API directly:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/autorag/rags/smokescan-rag/search" \
  -H "Authorization: Bearer ${CF_AUTORAG_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "char threshold ceiling deck", "max_num_results": 3}'
```

## Notes

- The `<think>` blocks from Qwen3-VL-Thinking model are stripped before returning responses
- Agent may make multiple RAG tool calls during a single request
- Polling timeout is set to 10 minutes to accommodate tool calling latency
