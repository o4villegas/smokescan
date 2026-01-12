"""
SmokeScan RunPod Handler - Qwen3-VL Vision Model
Uses Transformers directly for maximum compatibility with latest models.
"""

import runpod
import torch
import base64
import os
import json
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

    from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

    model_name = os.environ.get("MODEL_NAME", "Qwen/Qwen3-VL-30B-A3B-Thinking")

    print(f"Loading model: {model_name}")

    # Load processor
    processor = AutoProcessor.from_pretrained(
        model_name,
        trust_remote_code=True
    )

    # Load model with appropriate settings for 80GB GPU
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
        attn_implementation="flash_attention_2"
    )

    print(f"Model loaded successfully on {model.device}")


def decode_image(image_data: str) -> Image.Image:
    """Decode base64 image data to PIL Image."""
    # Handle data URL format
    if image_data.startswith("data:"):
        image_data = image_data.split(",", 1)[1]

    image_bytes = base64.b64decode(image_data)
    return Image.open(BytesIO(image_bytes)).convert("RGB")


def handler(job):
    """
    RunPod handler function.

    Expected input format (OpenAI-compatible):
    {
        "messages": [
            {"role": "system", "content": "..."},
            {"role": "user", "content": [
                {"type": "text", "text": "..."},
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
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

    # Extract messages
    messages = job_input.get("messages", [])
    sampling_params = job_input.get("sampling_params", {})

    max_tokens = sampling_params.get("max_tokens", 2000)
    temperature = sampling_params.get("temperature", 0.7)

    # Process messages to extract text and images
    processed_messages = []
    images = []

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
            text_parts = []
            for item in content:
                if item.get("type") == "text":
                    text_parts.append(item.get("text", ""))
                elif item.get("type") == "image_url":
                    image_url = item.get("image_url", {})
                    url = image_url.get("url", "")
                    if url.startswith("data:"):
                        images.append(decode_image(url))
                        text_parts.append("<image>")
                elif item.get("type") == "image":
                    # Direct base64 image
                    images.append(decode_image(item.get("image", "")))
                    text_parts.append("<image>")

            processed_messages.append({
                "role": role,
                "content": " ".join(text_parts)
            })

    # Build the prompt using the processor's chat template
    if images:
        # Multimodal input
        text = processor.apply_chat_template(
            processed_messages,
            tokenize=False,
            add_generation_prompt=True
        )

        inputs = processor(
            text=[text],
            images=images if images else None,
            return_tensors="pt",
            padding=True
        ).to(model.device)
    else:
        # Text-only input
        text = processor.apply_chat_template(
            processed_messages,
            tokenize=False,
            add_generation_prompt=True
        )

        inputs = processor(
            text=[text],
            return_tensors="pt",
            padding=True
        ).to(model.device)

    # Generate response
    with torch.no_grad():
        generated_ids = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature if temperature > 0 else None,
            do_sample=temperature > 0,
            pad_token_id=processor.tokenizer.pad_token_id,
            eos_token_id=processor.tokenizer.eos_token_id
        )

    # Decode output (excluding input tokens)
    generated_ids_trimmed = generated_ids[:, inputs.input_ids.shape[1]:]
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
