"""
SmokeScan RunPod Handler - Qwen3-VL Vision Model
Matches official HuggingFace instructions exactly.

Reference: https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking
"""
import runpod
import traceback
import os
import time

model = None
processor = None


def load_model():
    """Load the Qwen3-VL model and processor with verbose logging."""
    global model, processor

    # Check if already loaded (warm worker)
    if model is not None:
        print("=== MODEL ALREADY LOADED (WARM WORKER) - SKIPPING ===")
        return

    print("=" * 60)
    print("=== MODEL LOAD START ===")
    print("=" * 60)

    # Debug: Check cache configuration
    cache_dir = os.environ.get("HF_HOME", "/runpod-volume/huggingface")
    transformers_cache = os.environ.get("TRANSFORMERS_CACHE", "not set")

    print(f"HF_HOME: {cache_dir}")
    print(f"TRANSFORMERS_CACHE: {transformers_cache}")
    print(f"Cache directory exists: {os.path.exists(cache_dir)}")

    if os.path.exists(cache_dir):
        try:
            contents = os.listdir(cache_dir)
            print(f"Cache directory contents ({len(contents)} items): {contents[:10]}")
        except Exception as e:
            print(f"Could not list cache dir: {e}")

    # Check /runpod-volume mount
    print(f"/runpod-volume exists: {os.path.exists('/runpod-volume')}")
    if os.path.exists('/runpod-volume'):
        try:
            vol_contents = os.listdir('/runpod-volume')
            print(f"/runpod-volume contents: {vol_contents}")
        except Exception as e:
            print(f"Could not list /runpod-volume: {e}")

    model_name = "Qwen/Qwen3-VL-30B-A3B-Thinking"

    # Load processor
    print(f"\n--- Loading processor: {model_name} ---")
    proc_start = time.time()

    from transformers import AutoProcessor, AutoModelForVision2Seq

    processor = AutoProcessor.from_pretrained(model_name)
    print(f"Processor loaded in {time.time() - proc_start:.1f}s")

    # Load model
    print(f"\n--- Loading model: {model_name} ---")
    model_start = time.time()
    model = AutoModelForVision2Seq.from_pretrained(model_name, device_map="auto")
    print(f"Model loaded in {time.time() - model_start:.1f}s")

    print("=" * 60)
    print(f"=== MODEL LOAD COMPLETE (total: {time.time() - proc_start:.1f}s) ===")
    print("=" * 60)


def handler(job):
    """
    RunPod handler function.

    Expected input format:
    {
        "messages": [
            {"role": "system", "content": "..."},
            {"role": "user", "content": [
                {"type": "text", "text": "..."},
                {"type": "image", "image": "data:image/jpeg;base64,..."}
            ]}
        ],
        "max_tokens": 2000
    }

    Response format:
    {
        "output": "Generated response text..."
    }
    """
    try:
        request_start = time.time()
        print(f"\n>>> REQUEST START (job_id: {job.get('id', 'unknown')}) <<<")

        load_model()

        job_input = job["input"]
        messages = job_input.get("messages", [])
        max_tokens = job_input.get("max_tokens", 2000)

        if not messages:
            return {"error": "No messages provided"}

        print(f"Processing {len(messages)} messages, max_tokens={max_tokens}")

        inference_start = time.time()
        inputs = processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to(model.device)

        outputs = model.generate(**inputs, max_new_tokens=max_tokens)
        response = processor.decode(
            outputs[0][inputs["input_ids"].shape[-1]:],
            skip_special_tokens=True
        )

        inference_time = time.time() - inference_start
        total_time = time.time() - request_start
        print(f"Inference: {inference_time:.1f}s, Total: {total_time:.1f}s")
        print(f">>> REQUEST COMPLETE <<<\n")

        return {"output": response}

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"!!! HANDLER ERROR: {e}\n{error_trace}")
        return {"error": str(e), "traceback": error_trace}


runpod.serverless.start({"handler": handler})
