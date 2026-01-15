# SmokeScan - CLAUDE.md

## Agent Guardrails - READ FIRST

**CRITICAL:** Agents MUST follow documented processes exactly. Do NOT:
- Assume alternative deployment methods (deployment = git push ONLY)
- Invent patterns not documented in authoritative sources
- Deviate from FDAM methodology without explicit user approval
- Use undocumented APIs or configurations

**When in doubt:**
1. Check this CLAUDE.md first
2. Check RAG-KB/FDAM_v4_METHODOLOGY.md for domain logic
3. Check authoritative external references (linked below)
4. ASK the user via AskUserQuestion tool

**Authoritative Sources (always reference these):**
| Topic | Source |
|-------|--------|
| FDAM Methodology | `RAG-KB/FDAM_v4_METHODOLOGY.md` |
| Qwen3-VL Patterns | https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking |
| Cloudflare AutoRAG | https://developers.cloudflare.com/ai-search/ |
| RunPod Serverless API | https://docs.runpod.io/serverless/endpoints/send-requests |
| Deployment | Git push triggers Cloudflare auto-deploy (NO manual wrangler) |
| Production URL | https://smokescan.lando555.workers.dev/ |
| AI Search ID | `smokescan-rag` |
| Binding Prefix | `smokescan-` (required for all new bindings) |

---

## Project Overview

**SmokeScan** is a full-stack Fire Damage Assessment application implementing the **FDAM (Fire Damage Assessment Methodology) v4.0.1**. The system provides scientifically defensible restoration documentation for fire-damaged properties.

**Tech Stack:**
- **Frontend:** React 19 + Vite 6 + TypeScript
- **Backend:** Hono + Cloudflare Workers
- **Testing:** Vitest (unit/integration) + Playwright (browser/runtime)
- **Package Manager:** npm (exclusively)
- **Image Processing:** RunPod (qWEN3 30B VL model for vision, qWEN3 reranker/embedding for RAG)

---

## Quick Reference Commands

```bash
npm run dev              # Start dev server (use --host for WSL)
npm run build            # TypeScript compile + Vite build
npm run check            # Full validation (types + build + deploy dry-run)
npm run lint             # ESLint checks
npm run preview          # Preview production build locally
npm test                 # Run Vitest test suite
npm run test:e2e         # Run Playwright browser tests
```

## Deployment Model

**CRITICAL:** Deployment is handled via GitHub CI/CD:
- **Cloudflare Workers auto-deploys** when changes are pushed to GitHub
- There is NO manual `wrangler deploy` step
- **Deployment = `git push` to remote**

**Deployment Workflow:**
1. Run `npm run check` locally (must pass)
2. Run `npm test` locally (must pass)
3. Commit and push to GitHub
4. Cloudflare Workers automatically redeploys
5. **Request build logs from user** to confirm successful deployment
6. Do NOT mark deployment complete until build logs are reviewed

**CRITICAL:** Always expose dev servers for WSL access:
```bash
npm run dev -- --host
```

---

## Development Pillars - MANDATORY CONFIDENCE CHECKLIST

**AGENTS MUST verify 100% confidence in ALL items before implementation:**

- [ ] Plan based ONLY on empirical evidence from code analysis (zero assumptions)
- [ ] Plan necessity validated (no duplication of existing functionality)
- [ ] Plan designed for this specific project's architecture and constraints
- [ ] Plan complexity appropriate (neither over/under-engineered)
- [ ] Plan addresses full stack considerations (data layer, business logic, presentation, APIs)
- [ ] Plan includes appropriate testing strategy (unit via Vitest, browser via Playwright)
- [ ] Plan maximizes code reuse through enhancement vs. new development
- [ ] Plan includes code organization, cleanup, and documentation requirements
- [ ] Plan considers system-wide impact (routing, state management, data flow)
- [ ] Plan ensures complete feature delivery without shortcuts or placeholders
- [ ] Plan contains only validated assumptions with explicit confirmation sources
- [ ] Plan aligns with FDAM methodology (RAG-KB/FDAM_v4_METHODOLOGY.md is authoritative)

**DO NOT proceed to implementation until ALL checkboxes can be marked with 100% confidence.**

---

## Agent Behavior Requirements

### Plan Mode - MANDATORY

**Plan Mode is REQUIRED for ALL feature changes**, including seemingly simple ones. The workflow is:

1. **Enter Plan Mode** (shift+tab twice)
2. **Investigate** - Read relevant code empirically, never assume
3. **Design** - Create step-by-step implementation plan
4. **Present options** - When decisions needed, provide:
   - Options with recommendations based on empirical code evidence
   - Brief summary of why recommendation is better
   - At least one exception per rejected option that would change the recommendation
5. **Get approval** - Wait for explicit user approval
6. **Execute** - Switch to implementation mode

### Question Protocol

- **ALWAYS use AskUserQuestion tool** for clarifying questions
- **Investigate-first policy:** Explore codebase BEFORE asking questions
- **Never ask technical questions** - investigate empirically
- Ask questions related to **expected user experience**
- Recommend technically-feasible solutions based on **empirical code evidence**

### Test Failure Protocol

When a test fails:

1. **STOP all work immediately**
2. **Investigate** with 100% confidence whether the error is in:
   - The test itself, OR
   - The main application code
3. **Confirm with user** before proceeding
4. If error is in main application: **remediate according to process** (do not fix the test)
5. Only fix tests when confirmed with 100% confidence the test itself is wrong

### Next Steps Protocol

**ALWAYS provide "next steps" recommendations** after completing any investigation or task:
- Base recommendations on empirical evidence
- Cross-reference with actual implemented code
- Never assume - verify in the codebase

---

## FDAM Domain Reference

**Authoritative Source:** `RAG-KB/FDAM_v4_METHODOLOGY.md`

Any code that contradicts FDAM methodology must be flagged for review.

### Project Phases

| Phase | Name | Purpose |
|-------|------|---------|
| PRE | Pre-Restoration Evaluation | Site inspection, contamination mapping, zone classification |
| PRA | Pre-Restoration Assessment | Sampling, lab analysis, generates Cleaning Specification |
| RESTORATION | Contractor Execution | Work performed per specification |
| PRV | Post-Restoration Verification | Verification sampling, pass/fail determination |

### Zone Classifications

| Zone | Definition |
|------|------------|
| Burn Zone | Direct fire involvement |
| Near-Field | Adjacent to burn zone, heavy smoke/heat exposure |
| Far-Field | Smoke migration without direct heat exposure |

### Threshold Types

| Type | Source |
|------|--------|
| Standards-Based | Published, peer-reviewed, or regulatory sources (BNL SOP IH75190, EPA/HUD) |
| Professional Judgment | Field experience with empirical validation (particulates) |

### Key Deliverables

1. **Cleaning Specification / Scope of Work** - Scope, methods, labor, equipment, acceptance criteria
2. **Results Interpretation** - Threshold justification, regulatory basis, pass/fail determination
3. **Executive Summary Report** - Completion verification and compliance documentation

---

## Code Style & Patterns

### TypeScript Standards

```typescript
// Prefer 'type' OR 'interface' - both acceptable
type SampleResult = {
  analyte: string;
  value: number;
  threshold: number;
  pass: boolean;
};

// NEVER use enum - use string literal unions
type Zone = 'burn' | 'near-field' | 'far-field';
type Phase = 'PRE' | 'PRA' | 'RESTORATION' | 'PRV';
type Disposition = 'clean' | 'remove' | 'no-action';

// Use Zod for runtime validation (REQUIRED for API contracts)
import { z } from 'zod';

const SampleResultSchema = z.object({
  analyte: z.string(),
  value: z.number(),
  threshold: z.number(),
  pass: z.boolean(),
});

// Explicit return types on exported functions
export function calculatePassFail(value: number, threshold: number): boolean {
  return value < threshold;
}
```

### Error Handling - Result Types Required

**Never throw exceptions for expected error cases.** Use Result types:

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Example usage
async function fetchSampleData(id: string): Promise<Result<SampleData, ApiError>> {
  try {
    const response = await fetch(`/api/samples/${id}`);
    if (!response.ok) {
      return { success: false, error: { code: response.status, message: 'Failed to fetch' } };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: { code: 500, message: String(e) } };
  }
}
```

### API Contract Pattern (Hono + React)

**ALWAYS define Zod schemas for API endpoints:**

```typescript
// src/worker/schemas/sample.ts
import { z } from 'zod';

export const CreateSampleSchema = z.object({
  projectId: z.string(),
  location: z.string(),
  surfaceType: z.enum(['ceiling-deck', 'beam', 'column', 'floor']),
  zone: z.enum(['burn', 'near-field', 'far-field']),
});

export type CreateSampleInput = z.infer<typeof CreateSampleSchema>;

// src/worker/index.ts
app.post('/api/samples', async (c) => {
  const body = await c.req.json();
  const parsed = CreateSampleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error }, 400);
  }

  // ... implementation
  return c.json({ success: true, data: sample });
});
```

### Full-Stack Change Requirements

**API changes MUST be atomic:**
- If you modify a Worker endpoint, you MUST update corresponding frontend API calls
- If you modify frontend API calls, you MUST verify Worker endpoint compatibility
- Never commit partial changes that break frontend-backend contract

---

## Architecture

```
src/
├── react-app/           # Frontend React application
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Shared utilities
│   ├── types/           # Frontend type definitions
│   ├── App.tsx          # Main app component
│   └── main.tsx         # React entry point
├── worker/              # Cloudflare Worker backend
│   ├── routes/          # Hono route handlers
│   ├── schemas/         # Zod validation schemas
│   ├── services/        # Business logic
│   ├── types/           # Backend type definitions
│   └── index.ts         # Worker entry point
RAG-KB/                  # Knowledge base (FDAM methodology)
└── FDAM_v4_METHODOLOGY.md
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `SampleForm.tsx`, `ZoneSelector.tsx` |
| Utilities | camelCase | `formatDate.ts`, `calculateThreshold.ts` |
| Types | PascalCase + suffix | `SampleResponse`, `CreateProjectInput` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_SAMPLE_COUNT`, `DEFAULT_THRESHOLD` |
| Routes | kebab-case | `/api/project-phases`, `/api/sample-results` |

---

## Testing Requirements

### Test Strategy

| Type | Framework | When to Use |
|------|-----------|-------------|
| Unit | Vitest | Business logic, utilities, calculations |
| Integration | Vitest | API endpoints, data flow |
| Browser/E2E | Playwright | User workflows, visual regression |

### Test Naming Convention

```typescript
// Pattern: "should [action] when [condition]"
describe('calculatePassFail', () => {
  it('should return true when value is below threshold', () => {
    expect(calculatePassFail(100, 150)).toBe(true);
  });

  it('should return false when value equals threshold', () => {
    expect(calculatePassFail(150, 150)).toBe(false);
  });

  it('should return false when value exceeds threshold', () => {
    expect(calculatePassFail(200, 150)).toBe(false);
  });
});
```

### Testing Rules

- Test edge cases and error states
- Mock external services (RunPod, external APIs), NOT internal modules
- Match FDAM thresholds in tests (150 ash/char, 500 aciniform, etc.)
- Verify against FDAM methodology for business logic tests

---

## Verification Checklist

Before marking any task complete:

```
[ ] npm run check passes (types + build + deploy dry-run)
[ ] npm run lint passes
[ ] npm test passes (all Vitest tests)
[ ] npm run test:e2e passes (Playwright browser tests)
[ ] No console errors in browser
[ ] Feature works as expected in dev (test with --host for WSL)
[ ] API changes are atomic (frontend + backend updated together)
[ ] Code aligns with FDAM methodology
```

### Deployment Verification

After pushing to GitHub (which triggers Cloudflare auto-deploy):
1. Commit and push changes to GitHub
2. **Request build logs from user** to confirm successful Cloudflare deployment
3. Do NOT mark deployment complete until build logs are reviewed
4. If deployment fails, investigate logs before making fixes

---

## Slash Commands

Agents should **proactively recommend** these commands when appropriate:

| Command | When to Recommend |
|---------|-------------------|
| `/verify` | Before committing any changes |
| `/fix-errors` | When typecheck, lint, or tests fail |
| `/new-feature` | Starting any new feature implementation |
| `/review` | Before creating a PR |
| `/commit-push-pr` | After verification passes, ready to commit |
| `/pr-feedback` | When addressing PR review comments |

---

## DO NOT

- Use `any` type without explicit justification and comment
- Use `enum` - use string literal unions instead
- Throw exceptions for expected error cases - use Result types
- Commit commented-out code
- Use `console.log` for debugging - use proper logging
- Make assumptions - verify in codebase empirically
- Ask technical questions before investigating
- Proceed without Plan Mode approval
- Fix tests before confirming error location (test vs application)
- Push to GitHub without requesting build logs confirmation afterward
- Make partial API changes (frontend-only or backend-only)
- Contradict FDAM methodology without explicit user approval
- Use package managers other than npm (no bun, yarn, pnpm)
- Run `wrangler deploy` manually - deployment is via GitHub push (auto-deploy)
- Mark deployment complete without reviewing Cloudflare build logs

---

## External Integrations

### RunPod Image Processing

For bulk image processing (damage assessment images):
- **Vision Model:** Qwen3-VL-30B-A3B-Thinking
- **RAG:** Qwen3 reranker + Qwen3 embedding models

Image processing workflows will use RunPod serverless endpoints.

**Environment Variables (see `.env` file):**
- `RUNPOD_API_KEY` - API key for RunPod authentication
- `RUNPOD_RETRIEVAL_ENDPOINT_ID` - Retrieval endpoint (Embedding + Reranking, ~32GB VRAM)
- `RUNPOD_ANALYSIS_ENDPOINT_ID` - Analysis endpoint (Vision reasoning, ~40GB VRAM)

**Architecture:** "Retrieve First, Reason Last" - split endpoints for better scaling and cost efficiency.

**Note:** `.env` is gitignored. Use `.env.example` as template.

### Docker Workflow for RunPod Images

**CRITICAL:** Docker builds are expensive (time + GPU costs from reinitialization). Before any build:
1. **Verify code is 100% correct** - review all changes thoroughly
2. **Ensure this is the final build** - no incremental fixes

**Process:** Agents must NOT run Docker commands directly. Instead, provide PowerShell commands for the user to execute.

**IMPORTANT:** Always provide FULL PATH commands. User runs PowerShell from `C:\Users\Lando`, not the project directory.

**Build Command (provide to user):**
```powershell
# Run from any PowerShell location - uses full WSL path
docker build -t gvo555/smokescan-retrieval:vX \\wsl$\Ubuntu\home\lando555\smokescan\runpod-retrieval
```

**Push Command (provide to user):**
```powershell
# Run from PowerShell after build completes
docker push gvo555/smokescan-retrieval:vX
```

**Why PowerShell with full paths?**
- WSL networking causes timeouts on large layer pushes (16GB+ model layers)
- PowerShell bypasses WSL networking layer for direct Docker Hub access
- Full paths eliminate need to navigate directories first

**Version Tracking:**
- Current retrieval image: `gvo555/smokescan-retrieval:v4` (34.3GB, optimized)
- Always increment version number for new builds
- Document what changed in each version

**Qwen3-VL Authoritative References (USE THESE - do not deviate):**
- Model Card: https://huggingface.co/Qwen/Qwen3-VL-30B-A3B-Thinking
- Research Paper: https://huggingface.co/papers/2505.09388
- GitHub Repo: https://github.com/QwenLM/Qwen3-VL

When implementing Qwen3-VL features, ALWAYS reference these sources for:
- Prompting patterns and templates
- Input/output formats
- Configuration options
- Best practices

### Cloudflare AutoRAG

**Authoritative Documentation:** https://developers.cloudflare.com/ai-search/

**AI Search ID:** `smokescan-rag`

Use Cloudflare AutoRAG for:
- Vector search and embeddings
- RAG pipeline integration
- AI-powered search features

**CRITICAL:** Always reference the official Cloudflare documentation above when implementing AutoRAG features. Do not assume patterns from other RAG implementations.

### Cloudflare Workers

**Production URL:** https://smokescan.lando555.workers.dev/

- All backend runs on Cloudflare Workers edge network
- **Deployment is automatic via GitHub push** (CI/CD)
- Do NOT run `wrangler deploy` manually
- Source maps enabled for debugging
- Node.js compatibility enabled
- After pushing to GitHub, request build logs to confirm deployment success

**Binding Naming Convention:**
All Cloudflare bindings (KV, D1, R2, AI, etc.) MUST use `smokescan-` prefix:
- KV Namespace: `smokescan-kv`
- D1 Database: `smokescan-db`
- R2 Bucket: `smokescan-storage`
- AI Search: `smokescan-rag` (already configured)
- Queues: `smokescan-queue`

This prevents confusion across projects and environments.

---

## WSL Development Notes

This project runs in WSL (Ubuntu) accessed from Windows:
- Always use `--host` flag when starting dev servers
- Dev server default: `http://localhost:5173` (also accessible at WSL IP)
- Test from Windows browser using WSL IP or localhost

---

*CLAUDE.md v1.0 - SmokeScan/FDAM Project*
