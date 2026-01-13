"""
SmokeScan RunPod Handler - Qwen3-VL Agent with Local RAG Pipeline
Uses qwen-agent framework to orchestrate vision analysis + FDAM methodology retrieval.

Architecture:
1. vLLM server provides OpenAI-compatible API (started by start.sh)
2. qwen-agent connects to vLLM and handles tool orchestration
3. RAG tool uses local Qwen3-VL-Embedding-8B + FAISS + Qwen3-VL-Reranker-8B
4. Agent generates grounded reports with methodology citations
"""
import runpod
import re
import sys

print("SmokeScan Vision Handler - Starting initialization...")
print(f"Python version: {sys.version}")

# Import qwen-agent components
from qwen_agent.agents import Assistant

# Import custom RAG tool (registers it via @register_tool decorator)
from tools.rag_search import RAGSearch
print("RAG Search tool registered")

# Preload RAG pipeline at module load (before accepting requests)
# This loads Qwen3-VL-Embedding-8B + Qwen3-VL-Reranker-8B into VRAM
from rag.pipeline import get_rag_pipeline
print("Preloading RAG pipeline (embedding + reranker models)...")
_rag = get_rag_pipeline()
print(f"RAG pipeline ready! ({len(_rag.chunks)} chunks indexed)")

# FDAM Assessment System Prompt
FDAM_SYSTEM_PROMPT = """You are an expert fire damage assessment consultant implementing FDAM (Fire Damage Assessment Methodology) v4.0.1.

Your role is to analyze fire/smoke damage images and generate professional, scientifically-defensible assessment reports.

## Assessment Process

1. **Visual Analysis**: Carefully observe provided images for:
   - Zone classification (burn, near-field, far-field)
   - Damage types (char, smoke staining, soot deposits, heat damage)
   - Material identification and categorization (non-porous, semi-porous, porous, hvac)
   - Combustion indicators (aciniform soot patterns, char particles, ash residue)
   - Severity levels (heavy, moderate, light, trace, background)

2. **Methodology Retrieval**: Use the rag_search tool to retrieve relevant FDAM methodology for:
   - Cleaning protocols per surface type and condition level
   - Threshold criteria (particulates: ash/char <150/cm2, soot <500/cm2)
   - Disposition recommendations per FDAM section 4.3
   - Sampling requirements per FDAM section 2.3
   - Standards references (BNL SOP IH75190, NADCA ACR 2021)

3. **Report Generation**: Generate comprehensive report with:
   - Executive Summary (2-3 sentences)
   - Damage Assessment by Area (location, material, severity, observations)
   - FDAM Protocol Recommendations (cleaning methods, sequence, verification)
   - Disposition Summary (zone/condition matrix per FDAM section 4.3)
   - Sampling Plan Recommendations (per FDAM section 2.3)
   - Scope Indicators (labor intensity, equipment - NO dollar amounts)

## Zone Classification (IICRC/RIA/CIRI Technical Guide)
- **burn**: Direct fire involvement, visible char, structural damage from flames
- **near-field**: Adjacent to burn zone, heavy smoke/soot, heat exposure, no direct flames
- **far-field**: Smoke migration only, no direct heat exposure, light to moderate deposits

## Condition Scale
- **background**: No visible contamination, equivalent to unaffected areas
- **light**: Faint discoloration, minimal deposits visible on white wipe test
- **moderate**: Visible film or deposits, clear contamination on white wipe
- **heavy**: Thick deposits, surface texture obscured, significant odor indicators
- **structural-damage**: Physical damage requiring repair before cleaning

## Material Categories (FDAM section 4.3)
- **non-porous**: steel, concrete, glass, metal, CMU (cleanable)
- **semi-porous**: painted drywall, sealed wood (evaluate restorability)
- **porous**: carpet, insulation, acoustic tile (often requires removal)
- **hvac**: ductwork, interior insulation (per NADCA ACR standards)

## Critical Requirements
- ALWAYS use rag_search before making disposition or protocol recommendations
- Cite specific FDAM sections and standards from retrieved context
- Ground ALL recommendations in methodology - never speculate
- Be thorough and precise - use FDAM terminology throughout
- Do NOT include cost estimates or dollar amounts
"""

# Chat System Prompt (for follow-up conversations)
CHAT_SYSTEM_PROMPT = """You are an expert fire damage assessment consultant with access to a previous FDAM assessment.

You can answer follow-up questions about:
- Assessment findings and recommendations
- FDAM methodology and standards
- Cleaning protocols and procedures
- Sampling requirements and thresholds
- Material disposition guidelines

Use the rag_search tool when you need specific methodology information to answer questions accurately.
Always ground your responses in FDAM methodology.

Previous Assessment Context:
{session_context}
"""


def strip_think_blocks(text: str) -> str:
    """
    Remove <think>...</think> blocks from Qwen3-VL-Thinking model output.
    The model outputs reasoning in these blocks, but they should not be shown to users.
    """
    return re.sub(r'<think>[\s\S]*?</think>', '', text).strip()


def create_agent(system_prompt: str):
    """Create a qwen-agent Assistant configured for FDAM assessment."""
    llm_cfg = {
        'model_type': 'qwenvl_oai',
        'model': 'qwen3-vl',  # Served model name from vLLM
        'model_server': 'http://localhost:8000/v1',
        'api_key': 'EMPTY',
        'generate_cfg': {
            'max_new_tokens': 8000,
            'temperature': 0.7,
        }
    }

    return Assistant(
        llm=llm_cfg,
        function_list=['rag_search'],
        system_message=system_prompt,
    )


def handler(job):
    """
    RunPod handler - processes assessment and chat requests.
    Uses qwen-agent for tool orchestration.

    Input format:
    {
        "messages": [
            {"role": "user", "content": [
                {"type": "image", "image": "data:image/jpeg;base64,..."},
                {"type": "text", "text": "Analyze this fire damage."}
            ]}
        ],
        "max_tokens": 8000,
        "session_context": "..." (optional, for chat mode)
    }
    """
    try:
        job_input = job["input"]
        messages = job_input.get("messages", [])
        session_context = job_input.get("session_context", "")

        if not messages:
            return {"error": "No messages provided"}

        # Determine if this is chat mode (has session context)
        if session_context:
            system_prompt = CHAT_SYSTEM_PROMPT.format(session_context=session_context)
        else:
            system_prompt = FDAM_SYSTEM_PROMPT

        # Create agent
        agent = create_agent(system_prompt)

        # Run agent (handles tool orchestration automatically)
        final_response = ""
        for response in agent.run(messages):
            # Get the last assistant message with content
            for msg in reversed(response):
                if msg.get("role") == "assistant" and msg.get("content"):
                    content = msg["content"]
                    # Handle both string and list content formats
                    if isinstance(content, list):
                        texts = [item.get("text", "") for item in content if item.get("type") == "text"]
                        final_response = "\n".join(texts)
                    else:
                        final_response = content
                    break

        if not final_response:
            return {"error": "No response generated by agent"}

        # Strip <think> blocks before returning to user
        final_response = strip_think_blocks(final_response)

        return {"output": final_response}

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Handler error: {e}\n{error_trace}")
        return {"error": str(e), "traceback": error_trace}


print("Handler initialized - waiting for requests...")
runpod.serverless.start({"handler": handler})
