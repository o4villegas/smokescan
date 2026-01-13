"""
SmokeScan RunPod Handler - Qwen3-VL Vision Model
Based on official HuggingFace example:
https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking
"""
import runpod
import os
import sys
import traceback

# === DIAGNOSTIC: Print versions to help debug import issues ===
print("SmokeScan Vision Handler - Starting initialization...")
print(f"Python version: {sys.version}")

import transformers
print(f"Transformers version: {transformers.__version__}")

# === MODEL LOADING - BEFORE serverless.start() ===
# Per RunPod docs: "You will want models to be loaded into memory before starting serverless"
print("Importing model classes...")

try:
    from transformers import Qwen3VLMoeForConditionalGeneration, AutoProcessor
    print("Model classes imported successfully")
except ImportError as e:
    print(f"IMPORT ERROR: {e}")
    print("This usually means transformers version is incompatible.")
    print("Qwen3VLMoeForConditionalGeneration requires transformers>=4.57.1")
    print("Current Dockerfile pins transformers==4.57.3")
    raise

MODEL_NAME = "Qwen/Qwen3-VL-30B-A3B-Thinking"
RUNPOD_CACHE_DIR = "/runpod-volume/huggingface-cache/hub"


def find_cached_model_path(model_name):
    """Locate cached model using RunPod's cache structure."""
    cache_name = model_name.replace("/", "--")
    snapshots_dir = os.path.join(RUNPOD_CACHE_DIR, f"models--{cache_name}", "snapshots")

    if os.path.exists(snapshots_dir):
        snapshots = os.listdir(snapshots_dir)
        if snapshots:
            return os.path.join(snapshots_dir, snapshots[0])
    return None


# Check for RunPod cached model first
model_path = find_cached_model_path(MODEL_NAME)
if model_path:
    print(f"Using RunPod cached model at: {model_path}")
else:
    print(f"No RunPod cache found - loading from HuggingFace: {MODEL_NAME}")
    model_path = MODEL_NAME

print("Loading processor...")
processor = AutoProcessor.from_pretrained(model_path)
print("Processor loaded")

print("Loading model (this may take several minutes)...")
model = Qwen3VLMoeForConditionalGeneration.from_pretrained(
    model_path,
    dtype="auto",  # Correct for Qwen3-VL (verified from official docs)
    device_map="auto"
)
print("Model loaded successfully!")


def normalize_messages(messages):
    """
    Normalize message content to list format for Qwen3-VL processor.

    The processor's apply_chat_template expects consistent content format.
    When any message has list content (multimodal), ALL messages must use list format.
    This converts string content to [{"type": "text", "text": "..."}] format.
    """
    has_multimodal = any(
        isinstance(msg.get("content"), list) for msg in messages
    )

    if not has_multimodal:
        return messages

    normalized = []
    for msg in messages:
        content = msg.get("content")
        if isinstance(content, str):
            # Convert string content to list format
            normalized.append({
                "role": msg["role"],
                "content": [{"type": "text", "text": content}]
            })
        else:
            normalized.append(msg)

    return normalized


def handler(job):
    """
    RunPod handler - processes vision/text requests.
    Model is already loaded in memory.

    Input format:
    {
        "messages": [
            {"role": "user", "content": [
                {"type": "image", "image": "https://..."},
                {"type": "text", "text": "Describe this image."}
            ]}
        ],
        "max_tokens": 128
    }
    """
    try:
        job_input = job["input"]
        messages = job_input.get("messages", [])
        max_tokens = job_input.get("max_tokens", 128)

        if not messages:
            return {"error": "No messages provided"}

        # Normalize message format for multimodal requests
        messages = normalize_messages(messages)

        inputs = processor.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
            return_tensors="pt"
        ).to(model.device)

        generated_ids = model.generate(**inputs, max_new_tokens=max_tokens)
        generated_ids_trimmed = [
            out_ids[len(in_ids):]
            for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        output_text = processor.batch_decode(
            generated_ids_trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False
        )[0]

        return {"output": output_text}

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Handler error: {e}\n{error_trace}")
        return {"error": str(e), "traceback": error_trace}


runpod.serverless.start({"handler": handler})
