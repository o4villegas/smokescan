"""
FDAM RAG Tool for Qwen-Agent
Custom tool that queries Cloudflare AI Search for FDAM methodology
Called by Qwen3-VL when it needs fire damage assessment guidance

Reference: https://github.com/QwenLM/Qwen-Agent/blob/main/docs/tool.md
"""
import os
import json
import json5
import requests
from typing import Union, List
from qwen_agent.tools.base import BaseTool, register_tool

# Worker URL - production by default
WORKER_RAG_URL = os.environ.get(
    'SMOKESCAN_RAG_URL',
    'https://smokescan.lando555.workers.dev/api/rag/query'
)


@register_tool('fdam_rag')
class FDAMRagTool(BaseTool):
    """Tool for querying FDAM fire damage assessment methodology"""

    description = """Search the FDAM v4.0.1 (Fire Damage Assessment Methodology) knowledge base.

Key Thresholds:
- Ash/Char clearance: <150 particles/cm² (IHC professional judgment)
- Aciniform Soot clearance: <500 particles/cm² (IHC professional judgment)
- Lead Non-Operational: 22 µg/100cm² (BNL SOP IH75190)
- Lead Public-Childcare: 0.54 µg/100cm² (EPA/HUD Oct 2024)

Zone Classification:
- Burn Zone: Direct fire involvement, structural damage
- Near-Field: Adjacent to burn zone, heavy smoke/heat exposure
- Far-Field: Smoke migration without direct heat exposure

Disposition Matrix:
- Non-porous (steel, concrete): Cleanable in most zones
- Porous (insulation, carpet): Remove in Near-Field/Burn Zone
- Ceiling decks: Enhanced sampling (82.4% pass rate)

Example queries:
- "ash char clearance threshold 150 particles"
- "near-field zone porous material disposition"
- "ceiling deck enhanced sampling protocol"
- "zone classification criteria indicators"

Use this tool to retrieve FDAM methodology before making claims about thresholds, dispositions, or protocols."""

    # Parameters in Qwen-Agent list format (not JSON Schema)
    parameters = [
        {
            'name': 'query',
            'type': 'string',
            'description': 'Specific FDAM methodology query based on observed damage patterns, materials, or protocols needed',
            'required': True
        }
    ]

    def call(self, params: Union[str, dict], files: List[str] = None, **kwargs) -> str:
        """Execute RAG query against Cloudflare AI Search via Worker

        Args:
            params: Either a JSON string or dict containing 'query' key
            files: Optional list of file paths (not used)
            **kwargs: Additional arguments

        Returns:
            FDAM methodology context as string
        """
        # Parse params - can be string (JSON) or dict
        if isinstance(params, str):
            try:
                params = json5.loads(params)
            except Exception as e:
                return f'Error parsing parameters: {str(e)}'

        query = params.get('query', '')
        if not query:
            return 'Error: No query provided to fdam_rag tool'

        print(f'[fdam_rag] Querying: "{query[:100]}..."')

        try:
            response = requests.post(
                WORKER_RAG_URL,
                json={'query': query, 'maxChunks': 5},
                timeout=15,
                headers={'Content-Type': 'application/json'}
            )

            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    context = data['data']['context']
                    chunks = data['data'].get('chunks', 0)
                    print(f'[fdam_rag] Retrieved {chunks} chunks')
                    return context
                else:
                    error = data.get('error', 'Unknown error')
                    print(f'[fdam_rag] Query failed: {error}')
                    return f'FDAM RAG query failed: {error}'
            else:
                print(f'[fdam_rag] HTTP error: {response.status_code}')
                return f'FDAM RAG request failed with HTTP status {response.status_code}'

        except requests.exceptions.Timeout:
            print('[fdam_rag] Request timed out')
            raise RuntimeError('FDAM RAG request timed out - cannot proceed without methodology context')

        except requests.exceptions.RequestException as e:
            print(f'[fdam_rag] Network error: {e}')
            raise RuntimeError(f'FDAM RAG network error: {str(e)} - cannot proceed without methodology context')

        except Exception as e:
            print(f'[fdam_rag] Unexpected error: {e}')
            raise RuntimeError(f'FDAM RAG tool error: {str(e)}')
