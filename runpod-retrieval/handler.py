"""
SmokeScan Retrieval Endpoint - Embedding + Reranking + Image Embedding

This endpoint handles FDAM methodology retrieval using:
- Qwen3-VL-Embedding-8B for dense retrieval AND image embedding
- FAISS index for similarity search
- Qwen3-VL-Reranker-8B for reranking

Actions:
- "search" (default): Text-based RAG queries
- "embed": Generate embeddings for images (for Cloudflare Vectorize)

Search Input: {"action": "search", "queries": ["query1"], "top_k": 5}
Search Output: {"output": {"results": [{"query": "...", "chunks": [...]}]}}

Embed Input: {"action": "embed", "images": ["https://...", "data:image/jpeg;base64,..."], "instruction": "optional"}
Embed Output: {"output": {"embeddings": [[0.1, -0.2, ...], ...], "dimension": 4096}}
"""
import runpod
import sys
import base64
from io import BytesIO
from PIL import Image

print("SmokeScan Retrieval Handler - Starting initialization...")
print(f"Python version: {sys.version}")

# Import and initialize RAG pipeline (loads embedding + reranker models)
from rag.pipeline import get_rag_pipeline

print("Preloading RAG pipeline (embedding + reranker models)...")
rag = get_rag_pipeline()
print(f"RAG pipeline ready: {len(rag.chunks)} chunks indexed")


def decode_image(image_input):
    """
    Convert image input to format acceptable by embedder.

    Supports:
    - URLs (http/https) - passed through directly
    - Base64 data URIs (data:image/...) - decoded to PIL Image
    - File paths - passed through directly
    """
    if isinstance(image_input, str):
        if image_input.startswith("data:image"):
            # Base64 data URI - decode to PIL Image
            try:
                # Extract base64 data after the comma
                header, data = image_input.split(",", 1)
                image_bytes = base64.b64decode(data)
                return Image.open(BytesIO(image_bytes))
            except Exception as e:
                raise ValueError(f"Failed to decode base64 image: {e}")
        else:
            # URL or file path - pass through directly
            return image_input
    elif isinstance(image_input, Image.Image):
        # Already a PIL Image
        return image_input
    else:
        raise TypeError(f"Unsupported image type: {type(image_input)}")


def handle_search(job_input):
    """
    Handle text-based RAG search queries.

    Input: {"queries": ["query1", "query2"], "top_k": 5}
    Output: {"output": {"results": [{"query": "...", "chunks": [...]}]}}
    """
    queries = job_input.get("queries", [])
    top_k = job_input.get("top_k", 5)

    if not queries:
        return {"error": "No queries provided"}

    if not isinstance(queries, list):
        queries = [queries]

    print(f"[search] Processing {len(queries)} queries with top_k={top_k}")

    results = []
    for query in queries:
        chunks = rag.search(query, top_k=top_k)
        results.append({
            "query": query,
            "chunks": chunks
        })
        query_preview = query[:50] if len(query) > 50 else query
        print(f"  Query '{query_preview}...' -> {len(chunks) if isinstance(chunks, list) else 'formatted'} results")

    return {
        "output": {
            "results": results
        }
    }


def handle_embed(job_input):
    """
    Generate embeddings for images using Qwen3-VL-Embedding-8B.

    Input: {
        "images": ["https://...", "data:image/jpeg;base64,..."],
        "instruction": "optional task instruction"
    }

    Output: {
        "output": {
            "embeddings": [[0.1, -0.2, ...], ...],
            "dimension": 4096
        }
    }

    Embedding dimension is 4096 for Qwen3-VL-Embedding-8B (per official docs).
    """
    images = job_input.get("images", [])
    instruction = job_input.get("instruction")  # None = use model default

    if not images:
        return {"error": "No images provided"}

    if not isinstance(images, list):
        images = [images]

    print(f"[embed] Processing {len(images)} images")

    # Decode images (handle base64, URLs, file paths)
    decoded_images = []
    for i, img in enumerate(images):
        try:
            decoded = decode_image(img)
            decoded_images.append(decoded)
            img_type = "PIL" if isinstance(decoded, Image.Image) else "URL/path"
            print(f"  Image {i+1}: {img_type}")
        except Exception as e:
            return {"error": f"Failed to decode image {i+1}: {e}"}

    # Format inputs for embedder
    # Per official Qwen3-VL-Embedding pattern: {"image": ..., "instruction": ...}
    inputs = []
    for img in decoded_images:
        input_dict = {"image": img}
        if instruction:
            input_dict["instruction"] = instruction
        inputs.append(input_dict)

    # Get embeddings from the embedder
    try:
        embeddings = rag.embedder.process(inputs)
        # Convert to list for JSON serialization
        # embeddings is a torch tensor of shape (N, 4096)
        embeddings_list = embeddings.cpu().float().numpy().tolist()
        dimension = len(embeddings_list[0]) if embeddings_list else 0

        print(f"  Generated {len(embeddings_list)} embeddings of dimension {dimension}")

        return {
            "output": {
                "embeddings": embeddings_list,
                "dimension": dimension
            }
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[embed] Embedding error: {e}\n{error_trace}")
        return {
            "error": f"Embedding failed: {e}",
            "traceback": error_trace
        }


def handler(job):
    """
    Main handler with action routing.

    Actions:
    - "search" (default): Text-based RAG queries
    - "embed": Generate embeddings for images
    """
    try:
        job_input = job["input"]
        action = job_input.get("action", "search")  # Default to search for backwards compatibility

        print(f"Handler received action: {action}")

        if action == "search":
            return handle_search(job_input)
        elif action == "embed":
            return handle_embed(job_input)
        else:
            return {"error": f"Unknown action: {action}. Valid actions: search, embed"}

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Handler error: {e}\n{error_trace}")
        return {
            "error": str(e),
            "traceback": error_trace
        }


print("Retrieval Handler initialized - waiting for requests...")
runpod.serverless.start({"handler": handler})
