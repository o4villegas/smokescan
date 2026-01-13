"""
SmokeScan RAG Search Tool
Calls Cloudflare AI Search REST API for FDAM methodology retrieval.
"""
import os
import requests
from qwen_agent.tools.base import BaseTool, register_tool


@register_tool("rag_search")
class RAGSearch(BaseTool):
    """Search FDAM methodology knowledge base via Cloudflare AI Search REST API."""

    @property
    def description(self):
        return """
Search the FDAM (Fire Damage Assessment Methodology) knowledge base for:
- Cleaning protocols and procedures by surface type
- Threshold values (particulates: ash/char <150, soot <500; metals per BNL SOP)
- Zone classification criteria (burn, near-field, far-field)
- Sampling requirements per FDAM section 2.3
- Material disposition guidelines per FDAM section 4.3
- Standards references (BNL SOP IH75190, NADCA ACR 2021, IICRC S520)

Use this tool when you need specific FDAM methodology information to ground your assessment.
Always use this tool to retrieve methodology context for:
- Cleaning method recommendations
- Threshold criteria
- Disposition decisions
- Sampling requirements
""".strip()

    parameters = {
        "properties": {
            "query": {
                "description": "Search query for FDAM methodology (e.g., 'char threshold ceiling deck', 'HEPA protocol structural steel', 'porous material disposition')",
                "type": "string",
            },
        },
        "required": ["query"],
        "type": "object",
    }

    def __init__(self, cfg=None):
        super().__init__(cfg)
        self.api_token = os.environ.get("CF_AUTORAG_TOKEN")
        self.account_id = os.environ.get("CF_ACCOUNT_ID")
        self.rag_name = os.environ.get("CF_RAG_NAME", "smokescan-rag")

    def call(self, params, **kwargs):
        """Execute RAG search against Cloudflare AI Search REST API."""
        params = self._verify_json_format_args(params)
        query = params["query"]

        if not self.api_token or not self.account_id:
            return "[RAG Error: Missing CF_AUTORAG_TOKEN or CF_ACCOUNT_ID environment variables]"

        try:
            response = requests.post(
                f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/autorag/rags/{self.rag_name}/search",
                headers={
                    "Authorization": f"Bearer {self.api_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "query": query,
                    "rewrite_query": True,
                    "max_num_results": 5,
                    "reranking": {"enabled": True}
                },
                timeout=15
            )

            result = response.json()

            if result.get("success") and result.get("result", {}).get("data"):
                chunks = result["result"]["data"]
                formatted = []
                for chunk in chunks:
                    source = chunk.get("filename", "FDAM")
                    texts = [c["text"] for c in chunk.get("content", []) if c.get("type") == "text"]
                    content = "\n".join(texts)
                    if content:
                        formatted.append(f"[Source: {source}]\n{content}")

                if formatted:
                    return "\n\n---\n\n".join(formatted)
                else:
                    return f"No relevant FDAM methodology found for query: {query}"
            else:
                errors = result.get("errors", [])
                error_msg = errors[0].get("message", "Unknown error") if errors else "Unknown error"
                return f"[RAG Error: {error_msg}]"

        except requests.Timeout:
            return "[RAG Error: Request timed out - Cloudflare AI Search may be unavailable]"
        except requests.RequestException as e:
            return f"[RAG Error: Network error - {str(e)}]"
        except Exception as e:
            return f"[RAG Error: {str(e)}]"
