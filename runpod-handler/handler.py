"""
SmokeScan RunPod Handler - Qwen3-VL Vision Model
Uses Transformers directly for maximum compatibility with latest models.

Based on official Qwen3-VL documentation:
https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking
"""

import runpod
import torch
import base64
import os
from io import BytesIO
from PIL import Image

# Global model and processor (loaded once on cold start)
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

    # Load processor
    processor = AutoProcessor.from_pretrained(
        model_name,
        trust_remote_code=True
    )

    # Load model with appropriate settings for 80GB GPU
    model = Qwen3VLMoeForConditionalGeneration.from_pretrained(
        model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True
    )

    print(f"Model loaded successfully")


def decode_base64_to_pil(image_data: str) -> Image.Image:
    """Decode base64 image data to PIL Image."""
    # Handle data URL format
    if image_data.startswith("data:"):
        image_data = image_data.split(",", 1)[1]

    image_bytes = base64.b64decode(image_data)
    return Image.open(BytesIO(image_bytes)).convert("RGB")


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
    """
    load_model()

    job_input = job["input"]

    # Extract messages and params
    messages = job_input.get("messages", [])
    sampling_params = job_input.get("sampling_params", {})

    max_tokens = sampling_params.get("max_tokens", 2000)
    temperature = sampling_params.get("temperature", 0.7)

    # Process messages to convert base64 images to PIL Images
    processed_messages = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if isinstance(content, str):
            # Simple text message
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
                    # Direct base64 image
                    image_data = item.get("image", "")
                    if image_data.startswith("data:") or len(image_data) > 500:
                        # Base64 encoded - convert to PIL
                        pil_image = decode_base64_to_pil(image_data)
                        processed_content.append({
                            "type": "image",
                            "image": pil_image
                        })
                    else:
                        # URL - pass through
                        processed_content.append({
                            "type": "image",
                            "image": image_data
                        })
                elif item_type == "image_url":
                    # OpenAI format - convert to Qwen format
                    image_url = item.get("image_url", {})
                    url = image_url.get("url", "")
                    if url.startswith("data:"):
                        # Base64 encoded
                        pil_image = decode_base64_to_pil(url)
                        processed_content.append({
                            "type": "image",
                            "image": pil_image
                        })
                    else:
                        # Regular URL
                        processed_content.append({
                            "type": "image",
                            "image": url
                        })

            processed_messages.append({
                "role": role,
                "content": processed_content
            })

    # Use processor to prepare inputs (official Qwen3-VL method)
    inputs = processor.apply_chat_template(
        processed_messages,
        tokenize=True,
        add_generation_prompt=True,
        return_dict=True,
        return_tensors="pt"
    ).to(model.device)

    # Generate response
    with torch.no_grad():
        generated_ids = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature if temperature > 0 else None,
            do_sample=temperature > 0,
        )

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


# Start the RunPod serverless handler
runpod.serverless.start({"handler": handler})
