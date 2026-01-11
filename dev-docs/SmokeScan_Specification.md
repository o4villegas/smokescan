# SmokeScan: Technical Specification

## Project Overview

**SmokeScan** is an AI-powered fire damage assessment application that analyzes batch photos of fire/smoke-damaged rooms and generates FDAM-compliant assessment reports.

**Repository:** `git@github.com:o4villegas/smokescan.git`

**Core Capability:** Users submit multiple images of a single room along with metadata. The system produces a professional assessment report grounded in FDAM methodology, then supports follow-up questions about the findings.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: IMAGE ANALYSIS (RunPod)                                           │
│                                                                             │
│  Input:  Batch images + room metadata                                       │
│  Model:  Qwen3-VL-30B-A3B-Thinking                                          │
│  Output: Structured JSON (NOT shown to user)                                │
│          • Damage inventory (type, location, severity, material)            │
│          • Retrieval keywords (technical terms for RAG query)               │
│          • Severity classification code                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: RAG RETRIEVAL (Cloudflare AI Search)                              │
│                                                                             │
│  Input:  Retrieval keywords from Phase 1                                    │
│  Source: FDAM methodology docs, thresholds, domain knowledge (in R2)        │
│  Output: Relevant text chunks (procedures, standards, limits)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: SYNTHESIS (RunPod)                                                │
│                                                                             │
│  Input:  • Original images (for visual reference)                           │
│          • Phase 1 structured analysis                                      │
│          • Phase 2 RAG context                                              │
│          • User-provided metadata                                           │
│  Model:  Qwen3-VL-30B-A3B-Thinking (second call)                            │
│  Output: Natural language assessment report with formatting (shown to user) │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: SESSION PERSISTENCE                                               │
│                                                                             │
│  Stored: Assessment + images + RAG context                                  │
│  Purpose: Enable follow-up chat about this specific scenario                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Vite + React | Batch image upload, metadata form, report display, chat interface |
| **API/Orchestration** | Cloudflare Workers | Request routing, phase coordination, session management |
| **RAG Pipeline** | Cloudflare AI Search | Automated embedding, vector search, reranking |
| **Knowledge Store** | Cloudflare R2 | FDAM methodology docs, thresholds, domain knowledge |
| **Vector Database** | Cloudflare Vectorize | Managed by AI Search (no direct configuration needed) |
| **Vision Model** | RunPod Serverless + vLLM | Qwen3-VL-30B-A3B-Thinking |
| **Monitoring** | Cloudflare AI Gateway | Logging, caching, cost tracking |

---

## Data Flow Summary

### User Input
- Multiple JPEG/PNG images of a single room
- Metadata: room type, structure type, fire origin (optional), notes (optional)

### Phase 1 Output (Internal)
Structured damage inventory optimized for retrieval:
- Damage types using controlled vocabulary (e.g., `char_damage`, `smoke_staining`, `soot_deposit`)
- Location identifiers (e.g., `ceiling_northwest`, `wall_east`)
- Severity ratings (`heavy`, `moderate`, `light`, `trace`)
- Affected materials (e.g., `drywall`, `wood_stud`, `hvac_duct`)
- 5-10 technical retrieval keywords for RAG query

### Phase 2 Output (Internal)
Relevant chunks from knowledge base:
- FDAM protocol sections
- Damage threshold tables
- Cleaning/remediation procedures
- Material-specific guidelines

### Phase 3 Output (User-Facing)
Formatted assessment report containing:
- Executive summary
- Detailed damage assessment by area
- FDAM protocol recommendations
- Restoration priority matrix
- Cost estimation factors (scope indicators, not dollar amounts)

### Session State
Persisted for follow-up conversation:
- Original images
- Phase 1 analysis
- RAG chunks
- Final assessment
- Conversation history

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Two-call vision model pattern | First call extracts structured data for precise RAG retrieval; second call synthesizes human-readable report with full context |
| Cloudflare AI Search over manual RAG | Eliminates need for custom embedding/reranking deployment; fully managed pipeline |
| Structured keywords for retrieval | Technical vocabulary ensures relevant FDAM sections are retrieved vs. generic natural language |
| Session persistence | Enables contextual follow-up without re-analyzing images |
| vLLM Quick Deploy | Avoids Docker requirement; OpenAI-compatible API simplifies integration |

---

## Knowledge Base Contents (R2)

Documents to upload to `smokescan-knowledge` bucket:

```
/fdam/
  methodology.pdf       # Core FDAM assessment procedures
  thresholds.pdf        # Damage classification thresholds
  cleaning-protocols.pdf

/materials/
  drywall-standards.pdf
  wood-assessment.pdf
  hvac-guidelines.pdf

/domain/
  fire-damage-types.pdf
  smoke-residue-classification.pdf
  odor-elimination-procedures.pdf
```

AI Search will automatically chunk, embed, and index these documents.

---

## Infrastructure Setup Sequence

1. **Cloudflare R2** — Create bucket, upload FDAM knowledge base
2. **Cloudflare AI Search** — Create instance pointing to R2 bucket, enable reranking
3. **RunPod Serverless** — Deploy vLLM with Qwen3-VL-30B-A3B-Thinking
4. **Cloudflare Worker** — Build orchestration layer with AI Search binding
5. **Frontend** — React app with image upload, metadata form, report display, chat

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/assess` | Submit images + metadata, receive assessment |
| POST | `/api/chat` | Send follow-up question with session ID |
| GET | `/api/health` | Health check |

---

## Environment Configuration

### Worker Secrets
- `RUNPOD_API_KEY` — RunPod API authentication

### Worker Variables
- `RUNPOD_ENDPOINT` — RunPod serverless endpoint URL

### Frontend Variables
- `VITE_API_URL` — Worker API base URL

---

## Verification Checklist (Pre-Development)

Before implementing, the coding agent should verify:

- [ ] Qwen3-VL-30B-A3B-Thinking is available on RunPod vLLM Quick Deploy
- [ ] Confirm exact RunPod OpenAI-compatible endpoint path format
- [ ] Confirm AI Search Worker binding syntax (`env.AI.autorag()`)
- [ ] Verify vLLM accepts base64 images in OpenAI vision format
- [ ] Check SmokeScan repo structure and existing code patterns

---

## Estimated Costs (MVP)

| Service | Monthly Estimate |
|---------|-----------------|
| Cloudflare AI Search | Free (beta) |
| Cloudflare R2 | ~$0.15 |
| Cloudflare Vectorize | Free tier |
| Cloudflare Workers AI | ~$5-10 |
| RunPod L40S (~1hr/day) | ~$24 |
| **Total** | **~$30-40** |
