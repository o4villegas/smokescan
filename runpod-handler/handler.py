"""
SmokeScan RunPod Handler - Qwen3-VL Vision Model
Matches official HuggingFace instructions exactly.

Reference: https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking
"""
import runpod
import traceback
from transformers import AutoProcessor, AutoModelForVision2Seq

model = None
processor = None


def load_model():
    """Load the Qwen3-VL model and processor."""
    global model, processor

    if model is not None:
        return

    model_name = "Qwen/Qwen3-VL-30B-A3B-Thinking"

    print(f"Loading processor: {model_name}")
    processor = AutoProcessor.from_pretrained(model_name)
    print("Processor loaded")

    print(f"Loading model: {model_name}")
    model = AutoModelForVision2Seq.from_pretrained(model_name, device_map="auto")
    print("Model loaded")


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
        load_model()

        job_input = job["input"]
        messages = job_input.get("messages", [])
        max_tokens = job_input.get("max_tokens", 2000)

        if not messages:
            return {"error": "No messages provided"}

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

        return {"output": response}

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Handler error: {e}\n{error_trace}")
        return {"error": str(e), "traceback": error_trace}


runpod.serverless.start({"handler": handler})
