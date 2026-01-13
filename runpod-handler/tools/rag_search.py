"""
RAG Search Tool using local Qwen3-VL-Embedding + FAISS + Reranker

Replaces Cloudflare AI Search with local RunPod-native RAG pipeline.
"""
from qwen_agent.tools.base import BaseTool, register_tool
from rag.pipeline import get_rag_pipeline


@register_tool("rag_search")
class RAGSearch(BaseTool):
    """Search FDAM methodology using local embedding + reranking pipeline."""

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

Use this tool when you need specific methodology information to ground your assessment.
""".strip()

    parameters = {
        "properties": {
            "query": {
                "description": "Search query for FDAM methodology",
                "type": "string",
            },
        },
        "required": ["query"],
        "type": "object",
    }

    def call(self, params, **kwargs):
        params = self._verify_json_format_args(params)
        query = params["query"]

        try:
            rag = get_rag_pipeline()
            return rag.search(query, top_k=5)
        except Exception as e:
            return f"[RAG Error: {str(e)}]"
