# /verify - Verify All Changes

Run full verification suite before committing or creating a PR.

## Pre-compute context
```bash
git status --short
git diff --name-only
```

## Instructions

Run the following verification steps in order. **STOP and fix issues if any step fails.**

### Step 1: Full Check (Types + Build + Deploy Dry-Run)
```bash
npm run check
```

### Step 2: Lint
```bash
npm run lint
```

### Step 3: Run Unit Tests
```bash
npm test
```

### Step 4: Run Browser Tests (if configured)
```bash
npm run test:e2e 2>/dev/null || echo "E2E tests not configured yet"
```

### Step 5: FDAM Alignment Check

If changes touch FDAM-related code:
- Verify zone terminology: 'burn', 'near-field', 'far-field'
- Verify phase terminology: 'PRE', 'PRA', 'RESTORATION', 'PRV'
- Verify threshold values match RAG-KB/FDAM_v4_METHODOLOGY.md
- Verify API contracts are complete (frontend + backend)

### Step 6: Start Dev Server (Manual Check)
```bash
npm run dev -- --host &
sleep 3
curl -s http://localhost:5173 | head -5
curl -s http://localhost:5173/api/ | head -5
pkill -f "vite"
```

## Output

Provide a verification report:

```
## Verification Report

### Results
- [ ] npm run check: PASS/FAIL
- [ ] npm run lint: PASS/FAIL
- [ ] npm test: PASS/FAIL
- [ ] npm run test:e2e: PASS/FAIL/SKIPPED
- [ ] FDAM Alignment: PASS/FAIL/N/A
- [ ] Dev Server: PASS/FAIL

### Issues Found
[List any issues]

### Suggested Fixes
[For any failures]
```

If all steps pass, confirm the code is ready for commit.

## Deployment Model Reminder

**Deployment = git push to GitHub**
- Cloudflare Workers auto-deploys when changes are pushed
- Pushing to GitHub IS deploying to production
- After push, request build logs to confirm deployment success

## Next Steps

Based on verification results, recommend:
- If PASS: Ready for `/commit-push-pr` (pushing will trigger Cloudflare deploy)
- If FAIL: Use `/fix-errors` to address issues
