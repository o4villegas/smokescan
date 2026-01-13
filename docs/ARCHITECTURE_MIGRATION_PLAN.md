# SmokeScan Architecture Migration Plan

## Executive Summary

This document provides a comprehensive, empirically-verified analysis of the current Docker image and data pipeline, compared against the proposed "Retrieve First, Reason Last" target architecture. The proposed architecture offers significant improvements in scalability, availability, auditability, and GPU efficiency.

---

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [Proposed Target Architecture](#proposed-target-architecture)
3. [Gap Analysis](#gap-analysis)
4. [Implementation Plan](#implementation-plan)
5. [Migration Phases](#migration-phases)
6. [Risk Assessment](#risk-assessment)

---

## Current Architecture

### Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CURRENT: MONOLITHIC CONTAINER                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌──────────────────────────────────────────────┐  │
│  │ Cloudflare      │     │ RunPod Container (~80GB VRAM)                │  │
│  │ Worker          │     │                                              │  │
│  │                 │     │  ┌────────────────────────────────────────┐  │  │
│  │  • R2 (images)  │────▶│  │ vLLM Server (35% = ~28GB)              │  │  │
│  │  • D1 (metadata)│     │  │ Qwen3-VL-30B-A3B-Thinking              │  │  │
│  │  • KV (sessions)│     │  │ (Vision + Generation)                  │  │  │
│  │  • AI (unused)  │     │  └───────────────┬────────────────────────┘  │  │
│  │                 │     │                  │                            │  │
│  │  RAG Service    │     │                  ▼                            │  │
│  │  (placeholder)  │     │  ┌────────────────────────────────────────┐  │  │
│  │                 │     │  │ qwen-agent (Tool Orchestration)        │  │  │
│  └─────────────────┘     │  │ - Receives images + prompt             │  │  │
│                          │  │ - Calls rag_search tool                │  │  │
│                          │  │ - Returns final report                 │  │  │
│                          │  └───────────────┬────────────────────────┘  │  │
│                          │                  │                            │  │
│                          │                  ▼                            │  │
│                          │  ┌────────────────────────────────────────┐  │  │
│                          │  │ Local RAG Pipeline (~34GB)             │  │  │
│                          │  │ • Qwen3-VL-Embedding-8B (~16GB)        │  │  │
│                          │  │ • Qwen3-VL-Reranker-8B (~16GB)         │  │  │
│                          │  │ • FAISS Index (~2GB)                   │  │  │
│                          │  │   - 400-word chunks, 50-word overlap   │  │  │
│                          │  │   - topK=20 → rerank to top-5          │  │  │
│                          │  └────────────────────────────────────────┘  │  │
│                          │                                              │  │
│                          └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Current Request Flow

| Step | Location | Implementation |
|------|----------|----------------|
| 1. Image Upload | Worker `src/worker/routes/images.ts:14-84` | Images → R2 bucket, metadata → D1 |
| 2. Assessment Request | Worker `src/worker/routes/assess.ts:54-79` | Images converted to base64, sent to RunPod |
| 3. Agent Processing | `runpod-handler/handler.py:110-175` | qwen-agent receives all images + prompt |
| 4. RAG Retrieval | `runpod-handler/tools/rag_search.py:40-48` | Agent calls `rag_search` tool when needed |
| 5. KB Search | `runpod-handler/rag/pipeline.py:100-119` | FAISS retrieve top-20 → rerank to top-5 |
| 6. Report Generation | `runpod-handler/handler.py:146-157` | Agent generates final response |
| 7. Response Return | Worker `src/worker/services/runpod.ts:80-106` | Strip `<think>` blocks, return to user |

### Current Resource Requirements

| Component | VRAM | Notes |
|-----------|------|-------|
| Qwen3-VL-30B (vLLM) | ~28GB | `gpu-memory-utilization: 0.35` |
| Qwen3-VL-Embedding-8B | ~16GB | Loaded at handler startup |
| Qwen3-VL-Reranker-8B | ~16GB | Loaded at handler startup |
| FAISS Index | ~2GB | Built at container startup |
| **Total Required** | **~80GB** | Single A100-80GB or equivalent |

### Current Cloudflare Services Status

| Service | wrangler.json | Code | Status |
|---------|---------------|------|--------|
| **R2 (Images)** | ✓ `smokescan-images` | ✓ `storage.ts` | **ACTIVE** |
| **R2 (Reports)** | ✓ `smokescan-reports` | ✓ `storage.ts` | **ACTIVE** |
| **D1** | ✓ `smokescan-db` | ✓ `database.ts` | **ACTIVE** |
| **KV** | ✓ `SMOKESCAN_SESSIONS` | ✓ `session.ts` | **ACTIVE** |
| **Workers AI** | ✓ `AI` binding | ✓ `rag.ts` (placeholder) | **CONFIGURED, NOT USED** |
| **AutoRAG** | `smokescan-rag` (in code) | ✓ Health check only | **PLACEHOLDER** |
| **Vectorize** | ✗ Not configured | ✗ Not implemented | **MISSING** |

### Current Limitations

1. **Single Point of Failure** - All AI processing in one container
2. **High VRAM Requirement** - Requires expensive 80GB GPU
3. **Cold Start Latency** - Must load 3 models + build FAISS index
4. **No Image Retrieval** - All query images sent every time
5. **No Audit Trail** - No retrieval lineage for regulatory compliance
6. **KB Unavailable During Cold Start** - RAG only works when RunPod is warm

---

## Proposed Target Architecture

### Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   PROPOSED: RETRIEVE FIRST, REASON LAST                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      CLOUDFLARE (Edge)                                │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │ R2 Bucket   │  │ Vectorize   │  │ Vectorize   │  │ Workers AI  │  │  │
│  │  │ (Images)    │  │ kb_index    │  │ img_index   │  │ (Embedding) │  │  │
│  │  │ • orig      │  │ (text→text) │  │ (img→img)   │  │             │  │  │
│  │  │ • norm      │  │             │  │             │  │             │  │  │
│  │  │ • thumb     │  │             │  │             │  │             │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │         │               │               │               │            │  │
│  └─────────┼───────────────┼───────────────┼───────────────┼────────────┘  │
│            │               │               │               │               │
│            │         ┌─────┴─────┐   ┌─────┴─────┐         │               │
│            │         │ Step A:   │   │ Step B:   │         │               │
│            │         │ KB Search │   │ Img Search│         │               │
│            │         │ topK=20   │   │ topK=50   │         │               │
│            │         │ topN=6    │   │ +filter   │         │               │
│            │         └─────┬─────┘   └─────┬─────┘         │               │
│            │               │               │               │               │
│            │               │               ▼               │               │
│            │               │    ┌──────────────────────┐   │               │
│            │               │    │ RunPod Retrieval     │   │               │
│            │               │    │ (~32GB)              │   │               │
│            │               │    │ • Qwen3-VL-Emb-8B    │◀──┘               │
│            │               │    │ • Qwen3-VL-Rerank-8B │                   │
│            │               │    │ (Image embedding +   │                   │
│            │               │    │  Reranking topN=10)  │                   │
│            │               │    └──────────┬───────────┘                   │
│            │               │               │                               │
│            │               ▼               ▼                               │
│            │         ┌─────────────────────────────────┐                   │
│            │         │ Step C: RunPod Analysis (~40GB) │                   │
│            ▼         │                                 │                   │
│    ┌───────────┐     │ Qwen3-VL-30B-A3B-Thinking       │                   │
│    │ Signed    │────▶│ Inputs:                         │                   │
│    │ R2 URLs   │     │ • query_images (signed URLs)    │                   │
│    │ (5-15min) │     │ • kb_context_pack (top chunks)  │                   │
│    └───────────┘     │ • image_context_pack (metadata) │                   │
│                      │ • mode + schema_version         │                   │
│                      │                                 │                   │
│                      │ Output:                         │                   │
│                      │ • Structured result             │                   │
│                      │ • Citations (image_id, chunk_id)│                   │
│                      └─────────────────────────────────┘                   │
│                                        │                                   │
│                                        ▼                                   │
│                      ┌─────────────────────────────────┐                   │
│                      │ Step D: Audit Log (Cloudflare)  │                   │
│                      │ • kb_release_id                 │                   │
│                      │ • Retrieved image/chunk IDs     │                   │
│                      │ • Model + prompt versions       │                   │
│                      │ • Output + confidence           │                   │
│                      └─────────────────────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proposed Request Flow

#### Step A: Retrieve KB Context (Cloudflare)

```
Input: query_text, mode
Process:
  1. kb_query_vec = cloudflare_embed(query_text)
  2. kb_candidates = kb_index.search(kb_query_vec, topK=20)
  3. kb_context = filter_by_mode(kb_candidates, topN=6)
Output: kb_context_pack
```

#### Step B: Retrieve Image Context (Vectorize + RunPod)

```
Input: query_images[], claim_id
Process:
  1. For each query_image not embedded:
     - img_vec = runpod_retrieval.embed(query_image)
     - img_index.upsert(img_vec, metadata)
  2. img_candidates = img_index.search(query_vec, topK=50, filter={claim_id})
  3. topN_images = runpod_retrieval.rerank(query_text, img_candidates, n=10)
Output: image_context_pack
```

#### Step C: Analyze (RunPod Analysis)

```
Input:
  - mode: "observe" | "compare" | "extract"
  - query_images: signed_urls[]
  - kb_context_pack: {chunks[], doc_ids[]}
  - image_context_pack: {image_urls[], metadata[]}
  - schema_version: string (for EXTRACT mode)

Output:
  - structured_result: object
  - confidence: number
  - flags: string[]
  - citations: {image_ids[], chunk_ids[]}
```

#### Step D: Audit Log (Cloudflare)

```
Store:
  - request_id
  - kb_release_id
  - retrieved_kb_chunks: chunk_id[]
  - retrieved_images_pre_rerank: image_id[]
  - retrieved_images_post_rerank: image_id[]
  - model_versions: {analysis, embedding, reranker}
  - prompt_version
  - output
  - confidence
  - timestamp
```

### Mode Behavior

| Mode | KB Chunks Used | Image Behavior | Output Format |
|------|----------------|----------------|---------------|
| **OBSERVE** | Observable indicators | Analyze query images only | Confidence + what's visible |
| **COMPARE** | Consistency checks | Compare query vs retrieved | Consistent/inconsistent + triggers |
| **EXTRACT** | Schema + rubric + prohibited language | Reference for validation | Strict JSON + citations |

### Resource Requirements (Proposed)

| Endpoint | VRAM | GPU Type | Purpose |
|----------|------|----------|---------|
| RunPod Retrieval | ~32GB | A100-40GB or 2xA10 | Embedding + Reranking |
| RunPod Analysis | ~40GB | A100-40GB | Vision reasoning only |

**Total GPU Cost Reduction**: Can use smaller, cheaper GPUs; horizontal scaling possible.

---

## Gap Analysis

### 1. Knowledge Base Ingestion

| Aspect | Current | Proposed | Gap |
|--------|---------|----------|-----|
| **Embedding Model** | Qwen3-VL-Embedding-8B (RunPod) | Cloudflare Workers AI | Need to switch to Cloudflare embedding |
| **Storage** | Local FAISS in container | Cloudflare Vectorize `kb_index` | Need to create Vectorize index |
| **Chunking** | 400 words / 50 overlap | By headings (tables intact) | Need smarter chunking logic |
| **Metadata** | `source`, `doc_type` | `chunk_id`, `doc_id`, `section_path`, `kb_release_id`, `text` | Need richer metadata schema |
| **Update Process** | Container rebuild | Worker job (one-time) | Need ingestion Worker job |
| **Availability** | Only when RunPod warm | Always (Cloudflare edge) | **Major improvement** |

**Current Code Location**: `runpod-handler/rag/build_index.py`

**What's Missing**:
- Cloudflare Vectorize binding not configured in `wrangler.json`
- No `kb_index` created
- No KB ingestion script for Cloudflare
- Heading-aware chunking logic

### 2. Image Ingestion & Retrieval

| Aspect | Current | Proposed | Gap |
|--------|---------|----------|-----|
| **Upload Flow** | R2 only (orig) | R2 (orig + norm + thumb) | Need image normalization |
| **Embedding** | None | Qwen3-VL-Embedding on RunPod | Need new RunPod endpoint |
| **Vector Storage** | None | Cloudflare Vectorize `img_index` | Need new Vectorize index |
| **Metadata** | `assessmentId`, `originalFilename`, `uploadedAt` | `image_id`, `claim_id`, `room_id`, `capture_type`, `r2_norm_key` | Need richer metadata |
| **Retrieval** | None (all images sent) | Vectorize search + rerank | Need retrieval pipeline |
| **Cross-Claim** | N/A | Optional (filter by `claim_id`) | Need claim_id filtering |

**Current Code Location**: `src/worker/routes/images.ts`

**What's Missing**:
- Image normalization pipeline (sharp or similar)
- RunPod Retrieval endpoint configuration
- Vectorize `img_index` binding
- Signed URL generation with TTL
- On-upload embedding workflow

### 3. Per-Turn Runtime Flow

| Step | Current | Proposed | Gap |
|------|---------|----------|-----|
| **A: KB Retrieval** | Agent calls `rag_search` tool internally | Worker retrieves top-N from `kb_index` | Move retrieval to Worker |
| **B: Image Retrieval** | All query images sent | Vectorize search + RunPod rerank | Add image retrieval step |
| **C: Analysis** | Agent does everything | Only reasoning with context packs | Simplify RunPod job |
| **D: Audit** | None | Full audit log | Add audit storage |

**What's Missing**:
- Worker-side KB retrieval logic
- Image retrieval orchestration
- Simplified analysis endpoint
- Audit log schema and storage

### 4. Mode Support

| Mode | Current Support | Proposed | Gap |
|------|-----------------|----------|-----|
| **OBSERVE** | Implicit (single prompt) | Explicit mode with KB chunk filtering | Need mode parameter |
| **COMPARE** | Not implemented | Compare query vs retrieved images | Need comparison logic |
| **EXTRACT** | Not implemented | Strict JSON output + citations | Need schema enforcement |

**Current Code Location**: `runpod-handler/handler.py:33-69` (single FDAM_SYSTEM_PROMPT)

**What's Missing**:
- Mode parameter in API contract
- Mode-specific KB chunk filtering
- Mode-specific system prompts
- JSON schema enforcement for EXTRACT

### 5. Infrastructure

| Component | Current | Proposed | Gap |
|-----------|---------|----------|-----|
| **Vectorize kb_index** | Not configured | Required | Create binding |
| **Vectorize img_index** | Not configured | Required | Create binding |
| **RunPod Retrieval Endpoint** | Not exists | Required | Create new endpoint |
| **RunPod Analysis Endpoint** | Exists (combined) | Needs simplification | Modify handler |
| **Audit Log Storage** | Not exists | D1 or KV | Add schema + storage |

---

## Implementation Plan

### Phase 1: Cloudflare Infrastructure Setup

**Duration**: Foundation work

#### 1.1 Create Vectorize Indexes

```bash
# Create KB index
wrangler vectorize create smokescan-kb-index --dimensions 768 --metric cosine

# Create Image index
wrangler vectorize create smokescan-img-index --dimensions 3584 --metric cosine
```

**Note**: Dimension 768 is for Cloudflare's `@cf/baai/bge-base-en-v1.5` model. Dimension 3584 is for Qwen3-VL-Embedding-8B.

#### 1.2 Update wrangler.json

```json
{
  "vectorize": [
    {
      "binding": "SMOKESCAN_KB_INDEX",
      "index_name": "smokescan-kb-index"
    },
    {
      "binding": "SMOKESCAN_IMG_INDEX",
      "index_name": "smokescan-img-index"
    }
  ]
}
```

#### 1.3 Update WorkerEnv Type

```typescript
// src/worker/types/index.ts
export type WorkerEnv = {
  // ... existing bindings
  SMOKESCAN_KB_INDEX: VectorizeIndex;
  SMOKESCAN_IMG_INDEX: VectorizeIndex;
};
```

### Phase 2: Knowledge Base Migration

#### 2.1 Create KB Ingestion Script

**File**: `scripts/ingest-kb.ts`

```typescript
// Pseudocode
async function ingestKnowledgeBase() {
  const docs = await glob('RAG-KB/*.md');

  for (const doc of docs) {
    const chunks = chunkByHeadings(doc, { preserveTables: true });

    for (const chunk of chunks) {
      const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: chunk.text
      });

      await env.SMOKESCAN_KB_INDEX.upsert([{
        id: `${doc.id}#${chunk.id}`,
        values: embedding.data[0],
        metadata: {
          chunk_id: chunk.id,
          doc_id: doc.id,
          section_path: chunk.sectionPath,
          kb_release_id: KB_VERSION,
          text: chunk.text,
          doc_type: doc.isPrimary ? 'primary' : 'reference'
        }
      }]);
    }
  }
}
```

#### 2.2 Create KB Service

**File**: `src/worker/services/kb.ts`

```typescript
export class KBService {
  async search(query: string, topK = 20, topN = 6): Promise<KBContextPack> {
    const queryEmbedding = await this.ai.run('@cf/baai/bge-base-en-v1.5', {
      text: query
    });

    const results = await this.kbIndex.query(queryEmbedding.data[0], {
      topK,
      returnMetadata: true
    });

    return {
      chunks: results.matches.slice(0, topN).map(m => ({
        id: m.id,
        text: m.metadata.text,
        docId: m.metadata.doc_id,
        sectionPath: m.metadata.section_path,
        score: m.score
      })),
      kbReleaseId: results.matches[0]?.metadata.kb_release_id
    };
  }
}
```

### Phase 3: Image Pipeline

#### 3.1 Create RunPod Retrieval Endpoint

**File**: `runpod-handler-retrieval/handler.py`

```python
# Separate handler for embedding + reranking only
# Loads: Qwen3-VL-Embedding-8B + Qwen3-VL-Reranker-8B
# Does NOT load: Qwen3-VL-30B (saves ~28GB VRAM)

async def handler(job):
    job_input = job["input"]
    action = job_input.get("action")  # "embed" or "rerank"

    if action == "embed":
        images = job_input["images"]  # URLs or base64
        embeddings = embedder.process([{"image": img} for img in images])
        return {"embeddings": embeddings.tolist()}

    elif action == "rerank":
        query = job_input["query"]
        candidates = job_input["candidates"]  # [{id, text, ...}]
        scores = reranker.rerank(query, candidates)
        return {"ranked": sorted(zip(candidates, scores), key=lambda x: -x[1])}
```

#### 3.2 Update Image Upload Flow

**File**: `src/worker/routes/images.ts`

```typescript
// Enhanced upload with embedding
app.post('/api/images/upload', async (c) => {
  // 1. Upload original to R2
  const origKey = `${assessmentId}/orig/${filename}`;
  await env.SMOKESCAN_IMAGES.put(origKey, file);

  // 2. Create normalized version (resize, format)
  const normalized = await normalizeImage(file);
  const normKey = `${assessmentId}/norm/${filename}`;
  await env.SMOKESCAN_IMAGES.put(normKey, normalized);

  // 3. Create thumbnail
  const thumb = await createThumbnail(file);
  const thumbKey = `${assessmentId}/thumb/${filename}`;
  await env.SMOKESCAN_IMAGES.put(thumbKey, thumb);

  // 4. Get signed URL for norm image
  const signedUrl = await getSignedUrl(normKey, 15 * 60); // 15 min TTL

  // 5. Call RunPod Retrieval for embedding
  const embedding = await runpodRetrieval.embed([signedUrl]);

  // 6. Upsert to Vectorize
  await env.SMOKESCAN_IMG_INDEX.upsert([{
    id: imageId,
    values: embedding[0],
    metadata: {
      image_id: imageId,
      claim_id: claimId,
      room_id: roomId,
      capture_type: captureType,
      r2_norm_key: normKey
    }
  }]);

  // 7. Create DB record
  await db.createImage({ ... });

  return c.json({ success: true, imageId });
});
```

#### 3.3 Create Image Retrieval Service

**File**: `src/worker/services/imageRetrieval.ts`

```typescript
export class ImageRetrievalService {
  async retrieveContext(
    queryImages: string[],
    claimId: string,
    topK = 50,
    topN = 10
  ): Promise<ImageContextPack> {
    // 1. Get embeddings for query images
    const queryEmbeddings = await this.runpodRetrieval.embed(queryImages);

    // 2. Search Vectorize with claim_id filter
    const candidates = await this.imgIndex.query(queryEmbeddings[0], {
      topK,
      filter: { claim_id: claimId },
      returnMetadata: true
    });

    // 3. Rerank with RunPod
    const reranked = await this.runpodRetrieval.rerank(
      this.queryText,
      candidates.matches.map(m => m.metadata)
    );

    // 4. Get signed URLs for top results
    const topImages = reranked.slice(0, topN);
    const signedUrls = await Promise.all(
      topImages.map(img => this.getSignedUrl(img.r2_norm_key))
    );

    return {
      images: topImages.map((img, i) => ({
        id: img.image_id,
        url: signedUrls[i],
        metadata: img
      })),
      preRerankIds: candidates.matches.map(m => m.id),
      postRerankIds: topImages.map(img => img.image_id)
    };
  }
}
```

### Phase 4: Analysis Endpoint Refactor

#### 4.1 Simplify RunPod Analysis Handler

**File**: `runpod-handler-analysis/handler.py`

```python
# Analysis-only handler
# Loads: Qwen3-VL-30B-A3B-Thinking only
# Does NOT load: Embedding or Reranker models

SYSTEM_PROMPTS = {
    "observe": """You are analyzing fire damage images.
Report only what is directly observable with confidence levels.
Focus on: zone classification, damage indicators, surface conditions.""",

    "compare": """You are comparing fire damage images for consistency.
Compare the query images against the reference images provided.
Report: consistent/inconsistent findings with specific triggers.""",

    "extract": """You are extracting structured data from fire damage images.
Output ONLY valid JSON matching the provided schema.
Include citations for all claims."""
}

async def handler(job):
    job_input = job["input"]

    mode = job_input["mode"]  # observe | compare | extract
    query_images = job_input["query_images"]  # signed URLs
    kb_context = job_input["kb_context_pack"]  # pre-retrieved chunks
    image_context = job_input["image_context_pack"]  # pre-retrieved images
    schema_version = job_input.get("schema_version")

    # Build prompt with context
    system_prompt = SYSTEM_PROMPTS[mode]

    # Add KB context
    kb_section = format_kb_context(kb_context)

    # Add image context (for COMPARE mode)
    img_section = format_image_context(image_context) if mode == "compare" else ""

    # Call vLLM
    response = await vllm_client.chat.completions.create(
        model="qwen3-vl",
        messages=[
            {"role": "system", "content": f"{system_prompt}\n\n{kb_section}\n{img_section}"},
            {"role": "user", "content": [
                {"type": "text", "text": job_input["query"]},
                *[{"type": "image_url", "image_url": {"url": url}} for url in query_images]
            ]}
        ]
    )

    result = parse_response(response, mode)

    return {
        "result": result,
        "confidence": calculate_confidence(result),
        "citations": extract_citations(result, kb_context, image_context)
    }
```

### Phase 5: Orchestration & Audit

#### 5.1 Update Assessment Route

**File**: `src/worker/routes/assess.ts`

```typescript
app.post('/api/assess', async (c) => {
  const { mode, queryText, queryImages, claimId, schemaVersion } = await c.req.json();

  const startTime = Date.now();

  // Step A: Retrieve KB context (Cloudflare)
  const kbContext = await kbService.search(queryText, 20, 6);

  // Step B: Retrieve image context (Vectorize + RunPod)
  const imageContext = await imageRetrievalService.retrieveContext(
    queryImages,
    claimId,
    50,
    10
  );

  // Step C: Analyze (RunPod Analysis)
  const analysis = await runpodAnalysis.analyze({
    mode,
    queryImages: await getSignedUrls(queryImages),
    kbContextPack: kbContext,
    imageContextPack: imageContext,
    schemaVersion
  });

  // Step D: Audit log
  await auditService.log({
    requestId: crypto.randomUUID(),
    kbReleaseId: kbContext.kbReleaseId,
    retrievedKbChunks: kbContext.chunks.map(c => c.id),
    retrievedImagesPreRerank: imageContext.preRerankIds,
    retrievedImagesPostRerank: imageContext.postRerankIds,
    modelVersions: {
      analysis: 'qwen3-vl-30b-a3b-thinking',
      embedding: 'qwen3-vl-embedding-8b',
      reranker: 'qwen3-vl-reranker-8b'
    },
    promptVersion: PROMPT_VERSION,
    mode,
    output: analysis.result,
    confidence: analysis.confidence,
    processingTimeMs: Date.now() - startTime
  });

  return c.json({
    success: true,
    result: analysis.result,
    confidence: analysis.confidence,
    citations: analysis.citations
  });
});
```

#### 5.2 Create Audit Service

**File**: `src/worker/services/audit.ts`

```typescript
export class AuditService {
  async log(entry: AuditLogEntry): Promise<void> {
    // Store in D1 for queryability
    await this.db.prepare(`
      INSERT INTO audit_logs (
        request_id, kb_release_id, retrieved_kb_chunks,
        retrieved_images_pre_rerank, retrieved_images_post_rerank,
        model_versions, prompt_version, mode, output,
        confidence, processing_time_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.requestId,
      entry.kbReleaseId,
      JSON.stringify(entry.retrievedKbChunks),
      JSON.stringify(entry.retrievedImagesPreRerank),
      JSON.stringify(entry.retrievedImagesPostRerank),
      JSON.stringify(entry.modelVersions),
      entry.promptVersion,
      entry.mode,
      JSON.stringify(entry.output),
      entry.confidence,
      entry.processingTimeMs,
      new Date().toISOString()
    ).run();
  }
}
```

---

## Migration Phases

### Phase 1: Infrastructure (Week 1)
- [ ] Create Vectorize indexes (kb_index, img_index)
- [ ] Update wrangler.json with new bindings
- [ ] Update TypeScript types for new bindings
- [ ] Create audit_logs table in D1

### Phase 2: Knowledge Base (Week 2)
- [ ] Implement heading-aware chunking
- [ ] Create KB ingestion script
- [ ] Ingest all RAG-KB documents to Vectorize
- [ ] Create KBService with search method
- [ ] Test KB retrieval independently

### Phase 3: Image Pipeline (Week 3)
- [ ] Create RunPod Retrieval endpoint (embedding + reranking)
- [ ] Deploy Retrieval endpoint to RunPod
- [ ] Implement image normalization in upload flow
- [ ] Implement on-upload embedding
- [ ] Create ImageRetrievalService
- [ ] Test image retrieval independently

### Phase 4: Analysis Refactor (Week 4)
- [ ] Create simplified Analysis handler
- [ ] Implement mode-specific prompts
- [ ] Deploy Analysis endpoint to RunPod
- [ ] Update Worker to use new endpoint
- [ ] Test end-to-end flow

### Phase 5: Audit & Cleanup (Week 5)
- [ ] Implement AuditService
- [ ] Add audit logging to assessment flow
- [ ] Remove old monolithic handler
- [ ] Update documentation
- [ ] Performance testing

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Vectorize latency | Medium | Pre-warm indexes, cache frequent queries |
| RunPod cold starts | High | Use min_workers=1 for both endpoints |
| Embedding dimension mismatch | High | Verify dimensions before migration |
| Signed URL expiration | Medium | Use 15-min TTL, regenerate on retry |

### Operational Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Split deployment failure | High | Feature flag for gradual rollout |
| KB ingestion errors | Medium | Validate all chunks before upsert |
| Audit log storage costs | Low | Implement retention policy |

### Rollback Plan

1. Keep old monolithic handler deployed (don't delete)
2. Feature flag to switch between old/new flows
3. Monitor error rates during rollout
4. Automatic rollback if error rate > 5%

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Cold start time | ~5 min | <30 sec |
| GPU cost per request | ~$0.10 | <$0.05 |
| KB availability | RunPod-dependent | 99.9% |
| Audit coverage | 0% | 100% |
| Image retrieval accuracy | N/A | >90% |

---

## Appendix: Key File Locations

### Current Implementation
- `runpod-handler/Dockerfile` - Monolithic container
- `runpod-handler/start.sh` - Startup script
- `runpod-handler/handler.py` - Agent handler
- `runpod-handler/rag/build_index.py` - FAISS index builder
- `runpod-handler/rag/pipeline.py` - RAG pipeline
- `runpod-handler/models/qwen3_vl_embedding.py` - Embedding model wrapper
- `src/worker/services/runpod.ts` - Worker RunPod client
- `src/worker/routes/assess.ts` - Assessment endpoint

### Configuration
- `wrangler.json` - Cloudflare bindings
- `.env.example` - Environment variables
- `RAG-KB/` - Knowledge base documents

---

*Document Version: 1.0*
*Generated: 2026-01-13*
*Project: SmokeScan FDAM*
