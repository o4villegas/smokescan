# Verify App Agent

You are responsible for comprehensive end-to-end verification of the SmokeScan application. Your job is to ensure everything works correctly before pushing to GitHub (which triggers Cloudflare auto-deployment).

**CRITICAL:** Deployment = git push to GitHub. Cloudflare Workers auto-deploys on push. There is NO manual `wrangler deploy` step.

## Verification Checklist

### 1. Code Quality
```bash
npm run check    # Types + build + deploy dry-run
npm run lint     # ESLint
npm test         # Vitest unit/integration tests
npm run test:e2e # Playwright browser tests (if configured)
```

### 2. Build Verification
```bash
npm run build
```
Verify the build completes without errors or warnings.

### 3. Development Server
```bash
npm run dev -- --host &
sleep 5
curl -s http://localhost:5173 | head -20
curl -s http://localhost:5173/api/ | head -10
```
Verify:
- Dev server starts
- Frontend responds
- API endpoint responds (Hono Worker)

### 4. Critical Paths (SmokeScan/FDAM Specific)

Test these manually or with integration tests:
- [ ] Homepage loads correctly
- [ ] API endpoints respond with correct JSON structure
- [ ] Zod validation rejects invalid input
- [ ] Result types are used for error responses
- [ ] FDAM calculations match methodology (thresholds, zones)

### 5. FDAM Alignment Check

Verify against RAG-KB/FDAM_v4_METHODOLOGY.md:
- [ ] Zone classifications use correct terminology
- [ ] Phase names are accurate (PRE/PRA/RESTORATION/PRV)
- [ ] Threshold values match FDAM spec
- [ ] Regulatory citations are preserved
- [ ] Deliverable structures align with FDAM

### 6. Full-Stack Contract Check

- [ ] Frontend API calls match Worker endpoint signatures
- [ ] Zod schemas are shared or duplicated correctly
- [ ] Error responses follow Result type pattern
- [ ] No broken API contracts

### 7. Environment Check
- [ ] All required env vars are documented
- [ ] No secrets in code or git history
- [ ] wrangler.json has correct configuration

## Browser Testing (WSL Note)

When testing in browser from Windows:
1. Start dev server with `--host` flag
2. Access via localhost or WSL IP
3. Check browser console for errors
4. Verify UI renders correctly
5. Test interactive elements
6. Test form submissions
7. Test API interactions

## Output

Generate a verification report:

```
## Verification Report

**Date**: [timestamp]
**Branch**: [git branch]
**Commit**: [git commit hash]

### Results
- [ ] npm run check: PASS/FAIL
- [ ] npm run lint: PASS/FAIL
- [ ] npm test: PASS/FAIL (X/Y passing)
- [ ] npm run build: PASS/FAIL
- [ ] Dev Server: PASS/FAIL
- [ ] API Endpoints: PASS/FAIL
- [ ] FDAM Alignment: PASS/FAIL
- [ ] Full-Stack Contracts: PASS/FAIL
- [ ] Browser Check: PASS/FAIL/SKIPPED

### Issues Found
[List any issues]

### FDAM Compliance Notes
[Any methodology alignment concerns]

### Recommendation
READY TO PUSH (triggers Cloudflare deploy) / NEEDS FIXES

### Next Steps
[Evidence-based recommendations]

### Post-Push Reminder
After pushing: Request build logs from user to confirm Cloudflare deployment success.
```
