# SmokeScan RunPod Handler

Qwen3-VL agent with local RAG pipeline for FDAM fire damage assessment.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RunPod Container                                                           │
│  ┌──────────────────────────┐    ┌────────────────────────────┐            │
│  │  vLLM Server             │◄───│  qwen-agent Assistant      │            │
│  │  Qwen3-VL-30B-A3B-Thinking│   │  with rag_search tool      │            │
│  │  localhost:8000          │    └────────────────────────────┘            │
│  └──────────────────────────┘              │                                │
│                                            │ Tool Call                      │
│                                            ▼                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Local RAG Pipeline                                                  │   │
│  │  ┌───────────────────┐  ┌─────────┐  ┌───────────────────┐         │   │
│  │  │ Qwen3-VL-Embedding│─▶│  FAISS  │─▶│ Qwen3-VL-Reranker │         │   │
│  │  │ -8B               │  │  Index  │  │ -8B               │         │   │
│  │  └───────────────────┘  └─────────┘  └───────────────────┘         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

The agent:
1. Analyzes fire damage images using Qwen3-VL-30B-A3B-Thinking vision capabilities
2. Calls `rag_search` tool to retrieve relevant FDAM methodology (local embedding + reranking)
3. Generates grounded assessment reports with methodology citations

## Models

| Model | Purpose | Size |
|-------|---------|------|
| Qwen3-VL-30B-A3B-Thinking | Vision analysis + generation (via vLLM) | 30B |
| Qwen3-VL-Embedding-8B | Dense retrieval embeddings | 8B |
| Qwen3-VL-Reranker-8B | Relevance reranking | 8B |

## Files

- `handler.py` - RunPod serverless handler using qwen-agent
- `start.sh` - Startup script (builds FAISS index, starts vLLM server, then handler)
- `Dockerfile` - Container with vLLM + qwen-agent + FAISS + model files
- `tools/` - Custom tools for the agent
  - `rag_search.py` - Local RAG pipeline tool (embedding + FAISS + reranking)
- `rag/` - RAG pipeline components
  - `pipeline.py` - LocalRAGPipeline class (embed → retrieve → rerank)
  - `build_index.py` - FAISS index builder for FDAM knowledge base
- `models/` - Model wrapper classes (from Qwen3-VL-Embedding repo)
  - `qwen3_vl_embedding.py` - Embedding model wrapper
  - `qwen3_vl_reranker.py` - Reranker model wrapper
- `RAG-KB/` - FDAM knowledge base documents (indexed at startup)

## Model Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_NAME` | `Qwen/Qwen3-VL-30B-A3B-Thinking` | HuggingFace model ID for vLLM |

Note: Embedding and reranker model paths are configured in `rag/pipeline.py`.

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

## RAG Pipeline Details

### Document Source Hierarchy

Documents in `RAG-KB/` are indexed with source type metadata:

| Source Type | Label | Documents |
|-------------|-------|-----------|
| Primary | `[FDAM]` | `FDAM_v4_METHODOLOGY.md` (authoritative) |
| Reference | `[Reference]` | All other `.md` files (supporting detail) |

The agent is instructed to prefer `[FDAM]` sources for recommendations and use `[Reference]` sources for supporting detail only.

### Index Building

At container startup (`start.sh`):
1. `build_index.py` loads Qwen3-VL-Embedding-8B
2. All `.md` files in `RAG-KB/` are chunked (400 words, 50 word overlap)
3. Chunks are embedded and stored in FAISS index (Inner Product for cosine similarity)
4. GPU memory is cleared before vLLM starts

### Search Flow

1. **Embed** - Query embedded with instruction: "Retrieve FDAM methodology that answers this fire damage assessment question."
2. **Retrieve** - Top-20 candidates from FAISS index
3. **Rerank** - Qwen3-VL-Reranker-8B scores candidates, returns top-5
4. **Format** - Results labeled `[FDAM]` or `[Reference]` with relevance scores

## Notes

- The `<think>` blocks from Qwen3-VL-Thinking model are stripped before returning responses
- Agent may make multiple RAG tool calls during a single request
- FAISS index is built at runtime (first startup) to use GPU
- All three models run on GPU (requires sufficient VRAM)
