"""
SmokeScan RunPod Handler - Qwen3-VL Vision Model
Uses Transformers directly for maximum compatibility with latest models.

Based on official Qwen3-VL documentation:
https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking

Key findings from investigation:
- Model class: Qwen3VLMoeForConditionalGeneration (confirmed via config.json)
- Processor handles base64 data URLs directly (via qwen-vl-utils)
- No manual PIL conversion needed
- Accepts: PIL objects, file://, http(s)://, data:image/..., local paths
"""

import runpod
import torch
import os
import traceback

# Global model and processor (loaded once on cold start per RunPod best practices)
model = None
processor = None


def load_model():
    """Load the Qwen3-VL model and processor."""
    global model, processor

    if model is not None:
        return

    from transformers import Qwen3VLMoeForConditionalGeneration, AutoProcessor

    model_name = os.environ.get("MODEL_NAME", "Qwen/Qwen3-VL-30B-A3B-Thinking")

    print(f"Loading model: {model_name}")

    # Load processor first (lighter weight)
    processor = AutoProcessor.from_pretrained(
        model_name,
        trust_remote_code=True
    )
    print("Processor loaded")

    # Load model - uses auto dtype detection for optimal memory usage
    # ignore_mismatched_sizes handles potential version mismatches between
    # transformers and the model checkpoint
    model = Qwen3VLMoeForConditionalGeneration.from_pretrained(
        model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
        ignore_mismatched_sizes=True
    )
    print(f"Model loaded successfully on device(s): {model.hf_device_map if hasattr(model, 'hf_device_map') else 'auto'}")


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
        "sampling_params": {
            "max_tokens": 2000,
            "temperature": 0.1
        }
    }

    Image formats supported (handled by qwen-vl-utils):
    - data:image/jpeg;base64,... (base64 data URL)
    - https://example.com/image.jpg (HTTP URL)
    - file:///path/to/image.jpg (local file)
    """
    try:
        # Load model if not already loaded
        load_model()

        job_input = job["input"]

        # Extract messages and params
        messages = job_input.get("messages", [])
        sampling_params = job_input.get("sampling_params", {})

        if not messages:
            return {"error": "No messages provided"}

        max_tokens = sampling_params.get("max_tokens", 2000)
        temperature = sampling_params.get("temperature", 0.7)

        # Process messages - convert OpenAI format to Qwen format if needed
        processed_messages = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if isinstance(content, str):
                # Simple text message - pass through
                processed_messages.append({
                    "role": role,
                    "content": content
                })
            elif isinstance(content, list):
                # Multimodal message with text and images
                processed_content = []
                for item in content:
                    item_type = item.get("type", "")

                    if item_type == "text":
                        processed_content.append({
                            "type": "text",
                            "text": item.get("text", "")
                        })
                    elif item_type == "image":
                        # Qwen format - pass through directly
                        # qwen-vl-utils handles: base64, URLs, file paths, PIL objects
                        processed_content.append({
                            "type": "image",
                            "image": item.get("image", "")
                        })
                    elif item_type == "image_url":
                        # OpenAI format - convert to Qwen format
                        image_url = item.get("image_url", {})
                        url = image_url.get("url", "")
                        processed_content.append({
                            "type": "image",
                            "image": url
                        })

                processed_messages.append({
                    "role": role,
                    "content": processed_content
                })

        # Use processor to prepare inputs (official Qwen3-VL method)
        # The processor internally uses qwen-vl-utils which handles all image formats
        inputs = processor.apply_chat_template(
            processed_messages,
            tokenize=True,
            add_generation_prompt=True,
            return_dict=True,
            return_tensors="pt"
        ).to(model.device)

        # Generate response
        with torch.no_grad():
            generation_kwargs = {
                "max_new_tokens": max_tokens,
            }

            # Only add temperature/sampling if temperature > 0
            if temperature > 0:
                generation_kwargs["temperature"] = temperature
                generation_kwargs["do_sample"] = True
            else:
                generation_kwargs["do_sample"] = False

            generated_ids = model.generate(**inputs, **generation_kwargs)

        # Decode output (excluding input tokens)
        generated_ids_trimmed = [
            out_ids[len(in_ids):]
            for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]

        response_text = processor.batch_decode(
            generated_ids_trimmed,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False
        )[0]

        # Return OpenAI-compatible response format
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": inputs.input_ids.shape[1],
                "completion_tokens": len(generated_ids_trimmed[0]),
                "total_tokens": inputs.input_ids.shape[1] + len(generated_ids_trimmed[0])
            }
        }

    except Exception as e:
        # Return error details for debugging
        error_trace = traceback.format_exc()
        print(f"Handler error: {e}\n{error_trace}")
        return {
            "error": str(e),
            "traceback": error_trace
        }


# Start the RunPod serverless handler
runpod.serverless.start({"handler": handler})
