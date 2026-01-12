"""
SmokeScan RunPod Handler - Qwen3-VL Vision Model
Based on official HuggingFace example:
https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking
"""
import runpod
import traceback

model = None
processor = None


def load_model():
    """Load model using official HuggingFace pattern."""
    global model, processor

    if model is not None:
        print("Model already loaded (warm worker)")
        return

    from transformers import Qwen3VLMoeForConditionalGeneration, AutoProcessor

    model_name = "Qwen/Qwen3-VL-30B-A3B-Thinking"

    print(f"Loading processor: {model_name}")
    processor = AutoProcessor.from_pretrained(model_name)
    print("Processor loaded")

    print(f"Loading model: {model_name}")
    model = Qwen3VLMoeForConditionalGeneration.from_pretrained(
        model_name,
        dtype="auto",
        device_map="auto"
    )
    print("Model loaded successfully")


def handler(job):
    """
    RunPod handler - processes vision/text requests.

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
        load_model()

        job_input = job["input"]
        messages = job_input.get("messages", [])
        max_tokens = job_input.get("max_tokens", 128)

        if not messages:
            return {"error": "No messages provided"}

        inputs = processor.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
            return_tensors="pt"
        ).to(model.device)

        generated_ids = model.generate(**inputs, max_new_tokens=max_tokens)
        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
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
