"""
SmokeScan Analysis Endpoint - Two-Pass Transformers
Direct Qwen3-VL-32B-Instruct inference with contextual RAG

Architecture:
- Pass 1: Model observes images, outputs observations only
- RAG Fetch: Handler selects deterministic FDAM methodology queries
- Pass 2: Model generates full PRE report with methodology context

Input: {
    "messages": [...],        # Images + prompt in OpenAI format
    "max_tokens": 4096,
    "session_context": "..."  # Optional, for chat mode
}
Output: {"output": "assessment report"}
"""
import runpod
import torch
import requests
import re
from PIL import Image
from io import BytesIO
import base64

# Model configuration
MODEL_ID = "Qwen/Qwen3-VL-32B-Instruct"
RAG_URL = "https://smokescan.lando555.workers.dev/api/rag/query"
MAX_IMAGES = 10  # Prevent VRAM overflow

# Global model/processor (loaded once at startup)
model = None
processor = None


def load_model():
    """Load model at startup (not per-request)"""
    global model, processor

    from transformers import Qwen3VLForConditionalGeneration, AutoProcessor

    print(f"[Handler] Loading {MODEL_ID}...")
    processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
    model = Qwen3VLForConditionalGeneration.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
        attn_implementation="flash_attention_2",
        device_map="auto"
    ).eval()
    print("[Handler] Model loaded successfully")


# System prompts for two-pass generation
PASS1_SYSTEM_PROMPT = """You are a fire damage observation specialist.

If multiple images are provided, they are from the SAME space showing different angles. Synthesize observations across all images into a unified assessment.

Observe and document:
- Zone indicators: burn patterns, char, smoke staining, heat exposure
- Materials: steel, concrete, ceiling deck, insulation, HVAC, drywall
- Combustion products: soot, char, ash deposits
- Condition: background / light / moderate / heavy / structural

Output format:

## Observations
[Detailed observations as bullet points, noting specific materials and conditions observed]"""

PASS1_TEXT_ONLY_PROMPT = """You are an FDAM methodology specialist.

## Your Task
Analyze the user's question to understand:
- What fire damage scenario they're asking about
- What specific materials, zones, or procedures are relevant

Output format:

## Analysis
[Brief analysis of what the user is asking about - 2-3 sentences identifying key topics]"""

PASS2_SYSTEM_PROMPT_TEMPLATE = """You are a fire damage assessment consultant using FDAM v4.0.1.

## Reference Material
{rag_context}

## Observations
{observations}

{metadata_section}

Generate a PRE report with these sections:
1. Executive Summary - severity, zone classification, urgent items
2. Zone Classification - with FDAM methodology basis (consider field observations)
3. Surface Assessment - materials and conditions
4. Disposition - Clean / Remove / No-action per methodology
5. Sampling Recommendations - tape lifts, wipes, density (use room dimensions for calculation)

Use ONLY thresholds from the Reference Material. If a value isn't specified, say so.
Consider all field observations (smoke odor, white wipe results) when determining zone classification.

**Advisory**: Requires professional validation before remediation."""

PASS2_TEXT_ONLY_PROMPT = """You are an FDAM methodology expert.

## Reference Material
{rag_context}

## Question Context
{observations}

Answer the user's question using ONLY the reference material above. If the answer isn't in the reference, say so. Be concise."""

CHAT_PASS1_PROMPT_TEMPLATE = """You are continuing a fire damage assessment conversation.

## Previous Context
{session_context}

## Your Task
Based on the user's question and any new images, provide analysis of what they're asking about.

Output in this format:
## Analysis
[Brief analysis of what the user is asking about, noting key topics and materials mentioned]"""

CHAT_PASS2_PROMPT_TEMPLATE = """You are an expert fire damage assessment consultant continuing a previous assessment.

## Previous Context
{session_context}

## FDAM Methodology Reference
{rag_context}

## Your Analysis
{analysis}

## Your Task
Answer the user's question based on the assessment context and FDAM methodology above.

## Critical Requirements
- Base technical claims on the FDAM methodology provided
- Reference specific visual details if images are involved
- Include advisory notice when providing recommendations

**Advisory Notice**: This assessment is advisory and requires validation by qualified professionals before remediation."""


def decode_image(image_data: str) -> Image.Image:
    """Decode base64 image data to PIL Image"""
    if image_data.startswith("data:"):
        # Extract base64 from data URI
        _, data = image_data.split(",", 1)
    else:
        data = image_data
    return Image.open(BytesIO(base64.b64decode(data)))


def extract_images_and_text(messages: list) -> tuple:
    """Extract images and text from OpenAI-format messages"""
    images = []
    text_parts = []

    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", [])
            if isinstance(content, str):
                text_parts.append(content)
            elif isinstance(content, list):
                for item in content:
                    if item.get("type") == "image":
                        img_data = item.get("image") or item.get("image_url", {}).get("url", "")
                        if img_data:
                            images.append(decode_image(img_data))
                    elif item.get("type") == "text":
                        text_parts.append(item.get("text", ""))

    return images, " ".join(text_parts)


def extract_observations(text: str) -> str:
    """Extract observations/analysis section from Pass 1 output"""
    # Try Observations first (image mode), then Analysis (text-only mode)
    match = re.search(r'## Observations\s*([\s\S]*?)$', text)
    if not match:
        match = re.search(r'## Analysis\s*([\s\S]*?)$', text)
    return match.group(1).strip() if match else text


def extract_analysis(text: str) -> str:
    """Extract analysis section from chat Pass 1 output"""
    match = re.search(r'## Analysis\s*([\s\S]*?)$', text)
    return match.group(1).strip() if match else text


def extract_metadata_section(user_text: str) -> str:
    """Extract room metadata and field observations from user prompt.

    These sections are added by the frontend and contain:
    - Room Metadata: floor level, dimensions, area, volume, fire origin
    - Field Observations: smoke odor, white wipe test results

    Returns formatted metadata section or empty string if not found.
    """
    sections = []

    # Extract Room Metadata section
    room_match = re.search(r'## Room Metadata\s*([\s\S]*?)(?=##|$)', user_text)
    if room_match:
        sections.append(f"## Room Metadata\n{room_match.group(1).strip()}")

    # Extract Field Observations section
    field_match = re.search(r'## Field Observations\s*([\s\S]*?)(?=##|$)', user_text)
    if field_match:
        sections.append(f"## Field Observations\n{field_match.group(1).strip()}")

    return "\n\n".join(sections) if sections else ""


def query_rag(queries: list) -> str:
    """Query FDAM RAG for each query, combine results"""
    if not queries:
        return "No specific FDAM methodology requested."

    results = []
    for query in queries:
        try:
            print(f"[RAG] Querying: {query}")
            response = requests.post(
                RAG_URL,
                json={"query": query, "maxChunks": 3},
                timeout=15,
                headers={"Content-Type": "application/json"}
            )
            if response.ok:
                data = response.json()
                if data.get("success"):
                    context = data["data"]["context"]
                    chunks = data["data"].get("chunks", 0)
                    print(f"[RAG] Retrieved {chunks} chunks for '{query}'")
                    results.append(f"### Query: {query}\n{context}")
                else:
                    print(f"[RAG] Query failed: {data.get('error', 'Unknown')}")
            else:
                print(f"[RAG] HTTP error: {response.status_code}")
        except Exception as e:
            print(f"[RAG] Error querying '{query}': {e}")

    return "\n\n".join(results) if results else "RAG query failed - proceed with caution."


# Deterministic RAG queries - handler controlled, not model generated
# ALL queries verified against CF Workers AI Search on Jan 17, 2026
BASE_RAG_QUERIES = [
    "burn zone near-field far-field fire damage area definitions",  # Zone definitions
    "surface disposition matrix clean remove porous non-porous",     # Disposition matrix
    "particulate clearance thresholds ash char aciniform soot",      # 150/500 thresholds
]

CONTEXTUAL_QUERIES = {
    "metal": "metals clearance lead cadmium arsenic BNL thresholds",                    # BNL SOP
    "ceiling": "roof deck joists beams fire damage steel structure cleaning",           # 82.4% pass rate
    "deck": "roof deck joists beams fire damage steel structure cleaning",              # Alternate keyword
    "hvac": "HVAC duct cleaning NADCA ACR standards restoration",                       # NADCA ACR, 4 ACH
    "duct": "HVAC duct cleaning NADCA ACR standards restoration",                       # Alternate keyword
    "sample": "sampling protocol density per square foot fire damage verification",     # Density tables
    "clean": "standard cleaning sequence protocol methods",                             # Cleaning protocols
}


def get_rag_queries(user_text: str, observations: str = "") -> list:
    """
    Deterministic RAG query selection.

    Always includes base methodology queries.
    Adds contextual queries based on keywords in user request or observations.
    """
    queries = BASE_RAG_QUERIES.copy()

    # Combine user text and observations for keyword matching
    search_text = f"{user_text} {observations}".lower()

    for keyword, query in CONTEXTUAL_QUERIES.items():
        if keyword in search_text and query not in queries:
            queries.append(query)

    return queries[:5]  # Max 5 queries


def generate(user_text: str, images: list, system_prompt: str, max_tokens: int) -> str:
    """Run generation with given user text, images, and system prompt"""
    # Build content list for user message
    # Images first, then text (matching HF space pattern)
    content = []
    for _ in images:
        content.append({"type": "image"})
    content.append({"type": "text", "text": user_text})

    # Build messages with system prompt
    formatted_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": content}
    ]

    # Apply chat template
    prompt = processor.apply_chat_template(
        formatted_messages,
        tokenize=False,
        add_generation_prompt=True
    )

    # Process inputs
    inputs = processor(
        text=[prompt],
        images=images if images else None,
        return_tensors="pt",
        padding=True
    ).to(model.device)

    # Generate
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            do_sample=True,
            temperature=0.6,
            top_p=0.9,
            top_k=50,
            repetition_penalty=1.2
        )

    # Decode (skip input tokens)
    generated = outputs[0][inputs["input_ids"].shape[1]:]
    return processor.decode(generated, skip_special_tokens=True)


def handler(job):
    """Two-pass generation handler"""
    try:
        job_input = job["input"]
        messages = job_input.get("messages", [])
        max_tokens = job_input.get("max_tokens", 4096)
        session_context = job_input.get("session_context", "")

        if not messages:
            return {"error": "No messages provided"}

        images, user_text = extract_images_and_text(messages)
        print(f"[Handler] Processing {len(images)} images, text: {user_text[:100]}...")

        if session_context:
            # === CHAT MODE ===
            return handle_chat(images, user_text, session_context, max_tokens)
        else:
            # === ANALYSIS MODE ===
            return handle_analysis(images, user_text, max_tokens)

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Handler] Error: {e}\n{error_trace}")
        return {"error": str(e), "traceback": error_trace}


def handle_analysis(images: list, user_text: str, max_tokens: int) -> dict:
    """Handle initial fire damage analysis (two-pass)"""

    if len(images) > MAX_IMAGES:
        return {"error": f"Too many images ({len(images)}). Maximum is {MAX_IMAGES}."}

    # === PASS 1: Select prompt based on image presence ===
    if images:
        pass1_prompt = PASS1_SYSTEM_PROMPT
        img_word = "image" if len(images) == 1 else "images"
        print(f"[Handler] Pass 1: Analyzing {len(images)} {img_word} as unified space...")
    else:
        pass1_prompt = PASS1_TEXT_ONLY_PROMPT
        print("[Handler] Pass 1: Text-only query, identifying RAG needs...")

    pass1_output = generate(
        user_text=user_text,
        images=images,
        system_prompt=pass1_prompt,
        max_tokens=1024
    )
    print(f"[Handler] Pass 1 output: {pass1_output[:500]}...")

    # === RAG FETCH (Deterministic) ===
    observations = extract_observations(pass1_output)
    rag_queries = get_rag_queries(user_text, observations)
    print(f"[Handler] Deterministic RAG queries: {rag_queries}")

    rag_context = query_rag(rag_queries)

    # === EXTRACT METADATA (from frontend prompt) ===
    metadata_section = extract_metadata_section(user_text)
    if metadata_section:
        print(f"[Handler] Extracted metadata: {metadata_section[:200]}...")
    else:
        print("[Handler] No metadata section found in user prompt")

    # === PASS 2: Select prompt based on image presence ===
    if images:
        pass2_prompt = PASS2_SYSTEM_PROMPT_TEMPLATE.format(
            rag_context=rag_context,
            observations=observations,
            metadata_section=metadata_section
        )
        view_word = "view" if len(images) == 1 else "views"
        pass2_user_text = f"Generate PRE report for this space ({len(images)} {view_word}). User request: {user_text}"
        print("[Handler] Pass 2: Generating PRE report...")
    else:
        pass2_prompt = PASS2_TEXT_ONLY_PROMPT.format(
            rag_context=rag_context,
            observations=observations
        )
        pass2_user_text = f"Answer: {user_text}"
        print("[Handler] Pass 2: Generating direct answer...")

    final_output = generate(
        user_text=pass2_user_text,
        images=images,
        system_prompt=pass2_prompt,
        max_tokens=max_tokens
    )

    print(f"[Handler] Final output: {len(final_output)} chars")
    return {"output": final_output}


def handle_chat(images: list, user_text: str, session_context: str, max_tokens: int) -> dict:
    """Handle follow-up chat questions (two-pass)"""

    # === PASS 1: Determine needed RAG context ===
    pass1_prompt = CHAT_PASS1_PROMPT_TEMPLATE.format(session_context=session_context)

    print("[Handler] Chat Pass 1: Analyzing question...")
    pass1_output = generate(
        user_text=user_text,
        images=images,
        system_prompt=pass1_prompt,
        max_tokens=512
    )
    print(f"[Handler] Chat Pass 1 output: {pass1_output[:500]}...")

    # === RAG FETCH (Deterministic) ===
    analysis = extract_analysis(pass1_output)
    rag_queries = get_rag_queries(user_text, analysis)
    print(f"[Handler] Chat deterministic RAG queries: {rag_queries}")

    rag_context = query_rag(rag_queries)

    # === PASS 2: Answer Question ===
    pass2_prompt = CHAT_PASS2_PROMPT_TEMPLATE.format(
        session_context=session_context,
        rag_context=rag_context,
        analysis=analysis
    )

    print("[Handler] Chat Pass 2: Generating answer...")
    final_output = generate(
        user_text=user_text,
        images=images,
        system_prompt=pass2_prompt,
        max_tokens=max_tokens
    )

    print(f"[Handler] Chat output: {len(final_output)} chars")
    return {"output": final_output}


# Load model at startup
print("[Handler] Initializing SmokeScan Two-Pass Handler...")
load_model()
print("[Handler] Handler ready, starting RunPod serverless...")
runpod.serverless.start({"handler": handler})
