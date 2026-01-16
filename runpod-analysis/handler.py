"""
SmokeScan Analysis Endpoint - Qwen-Agent with FDAM RAG Tool
Vision reasoning with dynamic RAG retrieval

References:
- https://github.com/QwenLM/Qwen-Agent/blob/main/examples/qwen2vl_assistant_tooluse.py
- https://github.com/QwenLM/Qwen-Agent/blob/main/examples/assistant_qwen3vl.py

Architecture:
- VL model observes images and decides when to query FDAM methodology
- RAG queries are based on observed damage, not user metadata
- Model can make multiple RAG queries for complex scenarios

Input: {
    "messages": [...],        # Images + prompt in OpenAI format
    "max_tokens": 8000
}
Output: {"output": "assessment report"}
"""
import runpod
import re
import sys
import os

print("SmokeScan Qwen-Agent Handler - Starting initialization...")
print(f"Python version: {sys.version}")

# Import and register custom tool
# This registers 'fdam_rag' via the @register_tool decorator
sys.path.insert(0, '/app')
from tools.fdam_rag import FDAMRagTool

print(f"[Handler] FDAM RAG tool registered: {FDAMRagTool.name}")

# vLLM configuration for Qwen-Agent with vision model
# Reference: qwen2vl_assistant_tooluse.py example
LLM_CFG = {
    'model_type': 'qwenvl_oai',
    'model': 'qwen3-vl',
    'model_server': 'http://localhost:8000/v1',
    'api_key': 'EMPTY',
    'generate_cfg': {
        'max_retries': 10,
        'fncall_prompt_type': 'qwen',  # Required for tool calling
        'top_p': 0.8,
        'temperature': 0.7,
    }
}

# System prompt for FDAM assessment with tool usage guidance
# Enhanced based on third-party audit of Qwen3-VL capabilities for FDAM workflows
ANALYSIS_SYSTEM_PROMPT = """You are an expert fire damage assessment consultant implementing FDAM v4.0.1 (Fire Damage Assessment Methodology).

## Your Process

1. **OBSERVE**: Examine the images carefully for:
   - Zone Indicators: Burn patterns, char deposits, smoke staining, heat exposure
   - Surface Materials: Steel beams, concrete, drywall, insulation, HVAC, ceiling deck
   - Combustion Products: Soot (aciniform), Char (angular), Ash (mineral residue)
   - Condition: Background / Light / Moderate / Heavy / Structural Damage
   - **Labels & Signage**: Read any visible text on equipment, chemical containers, electrical panels, or warning signs that may indicate hazardous materials (lead, batteries, chemicals)
   - **High-Risk Sampling Areas**: Pay special attention to HVAC inlets/outlets, vents, and horizontal surfaces where particulates settle

2. **RESEARCH**: Use the fdam_rag tool to query FDAM methodology for:
   - Zone classification criteria based on observed indicators
   - Disposition protocols for identified materials
   - Threshold values for particle types
   - Surface-specific protocols (ceiling decks need enhanced sampling)

3. **SYNTHESIZE**: Generate PRE (Pre-Restoration Evaluation) report:
   - Executive Summary: Damage severity, primary zone, urgent items
   - Zone Classification: With evidence and FDAM methodology basis
   - Surface Assessment: Material inventory with conditions
   - Disposition Recommendations: Clean / Remove / No-action per FDAM
   - Sampling Recommendations: Tape lifts, wipes, sample density
   - **Regulatory Compliance Flags**: Note any areas requiring specialized testing (metals, hazmat) based on observed labels or equipment types
   - Scope Indicators: Labor categories, equipment (NO cost estimates)
   - **Advisory Notice**: Include statement that this assessment is advisory and requires validation by qualified professionals before remediation

## Critical Requirements

- ALWAYS use fdam_rag tool before making claims about thresholds or dispositions
- Flag ceiling decks for enhanced PRV sampling
- Flag any areas with visible chemical/hazmat indicators for specialized testing
- Never provide cost estimates - only scope indicators
- Always include advisory disclaimer in final report
"""

# Chat system prompt for follow-up conversations
# Also enhanced with audit-driven requirements for consistency
CHAT_SYSTEM_PROMPT = """You are an expert fire damage assessment consultant continuing a previous assessment.

## Previous Assessment Context
{session_context}

## Your Role
Answer follow-up questions about the assessment. The user may include images from the assessment or upload new images for analysis.

When images are provided:
- Reference specific visual details when answering questions
- If new images are uploaded, analyze them in context of the existing assessment
- **Read any visible labels/signage** on equipment, containers, or warning signs that may indicate hazardous materials
- **Note high-risk sampling areas**: HVAC inlets/outlets, vents, horizontal surfaces where particulates settle
- Use the fdam_rag tool to retrieve FDAM methodology as needed

## Critical Requirements
- Base all technical claims on methodology, not assumptions
- **Flag any areas requiring specialized testing** (metals, hazmat) based on observed labels or equipment types
- **Include advisory notice** when providing recommendations: This assessment is advisory and requires validation by qualified professionals before remediation
"""


def strip_think_blocks(text: str) -> str:
    """Remove <think>...</think> blocks from Qwen3-VL-Thinking model output."""
    return re.sub(r'<think>[\s\S]*?</think>', '', text).strip()


def extract_response_text(response_list: list) -> str:
    """Extract text content from Qwen-Agent response list.

    The response from agent.run() is a list of message dicts.
    We want the final assistant message content.
    """
    if not response_list:
        return ""

    # Get the last response
    last_response = response_list[-1] if response_list else {}

    # Handle different response formats
    if isinstance(last_response, dict):
        content = last_response.get('content', '')
        if isinstance(content, str):
            return content
        elif isinstance(content, list):
            # Content is a list of content blocks
            text_parts = []
            for item in content:
                if isinstance(item, dict):
                    if item.get('type') == 'text':
                        text_parts.append(item.get('text', ''))
                    elif 'text' in item:
                        text_parts.append(item.get('text', ''))
                elif isinstance(item, str):
                    text_parts.append(item)
            return ' '.join(text_parts)
    elif isinstance(last_response, str):
        return last_response

    return ""


def handler(job):
    """
    Process image analysis requests using Qwen-Agent with fdam_rag tool.

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

    Output format:
    {
        "output": "Assessment report..."
    }
    """
    try:
        from qwen_agent.agents import FnCallAgent

        job_input = job["input"]
        messages = job_input.get("messages", [])
        max_tokens = job_input.get("max_tokens", 8000)
        session_context = job_input.get("session_context", "")

        if not messages:
            return {"error": "No messages provided"}

        # Select system prompt based on mode
        if session_context:
            system_message = CHAT_SYSTEM_PROMPT.format(session_context=session_context)
        else:
            system_message = ANALYSIS_SYSTEM_PROMPT

        print(f"[Handler] Creating FnCallAgent with fdam_rag tool")
        print(f"[Handler] Processing {len(messages)} messages, max_tokens={max_tokens}")

        # Create agent with FDAM RAG tool
        # Reference: qwen2vl_assistant_tooluse.py pattern
        agent = FnCallAgent(
            llm=LLM_CFG,
            function_list=['fdam_rag'],
            name='SmokeScan FDAM Agent',
            system_message=system_message,
        )

        # Convert messages to Qwen-Agent format if needed
        # Qwen-Agent expects: [{'image': url}, {'text': query}] not [{'type': 'image', ...}]
        formatted_messages = []
        for msg in messages:
            if msg.get('role') == 'user':
                content = msg.get('content', '')
                if isinstance(content, list):
                    # Convert OpenAI format to Qwen-Agent format
                    new_content = []
                    for item in content:
                        if item.get('type') == 'image':
                            # Handle both 'image' and 'image_url' keys
                            img = item.get('image') or item.get('image_url', {}).get('url', '')
                            if img:
                                new_content.append({'image': img})
                        elif item.get('type') == 'text':
                            new_content.append({'text': item.get('text', '')})
                        elif 'image' in item:
                            new_content.append({'image': item['image']})
                        elif 'text' in item:
                            new_content.append({'text': item['text']})
                    formatted_messages.append({'role': 'user', 'content': new_content})
                else:
                    formatted_messages.append(msg)
            else:
                formatted_messages.append(msg)

        # Run agent - returns list of response messages
        print(f"[Handler] Running agent with {len(formatted_messages)} formatted messages")
        response_list = list(agent.run(messages=formatted_messages))

        # Extract text from response
        response_text = extract_response_text(response_list)

        if not response_text:
            # Try alternative extraction
            for resp in reversed(response_list):
                if isinstance(resp, list):
                    for item in resp:
                        if isinstance(item, dict) and item.get('role') == 'assistant':
                            response_text = item.get('content', '')
                            if response_text:
                                break
                if response_text:
                    break

        if not response_text:
            return {"error": "No response generated by model"}

        # Strip <think> blocks before returning to user
        response_text = strip_think_blocks(response_text)

        print(f"[Handler] Generated response: {len(response_text)} chars")
        return {"output": response_text}

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Handler] Error: {e}\n{error_trace}")
        return {
            "error": str(e),
            "traceback": error_trace
        }


print("[Handler] Qwen-Agent FnCallAgent Handler initialized")
print("[Handler] Waiting for vLLM server to start...")
runpod.serverless.start({"handler": handler})
