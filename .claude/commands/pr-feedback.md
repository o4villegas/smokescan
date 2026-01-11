# /pr-feedback - PR Feedback Handler

Address PR feedback and update CLAUDE.md if needed.

## Pre-compute context
```bash
git branch --show-current
git log -1 --format="%s"
cat CLAUDE.md | head -100
```

## Instructions

When handling PR feedback:

### 1. Understand the Feedback
- What specific changes are requested?
- Is this a style/convention issue or a bug?
- Should this become a project-wide rule?
- **Does this affect FDAM compliance?**

### 2. Investigate Before Acting

**CRITICAL:** Before making any changes:
- Investigate the codebase empirically
- Understand why the current code exists
- Verify if the feedback aligns with FDAM methodology
- Confirm the fix won't break API contracts

### 3. Make the Fix
- Address the specific feedback
- Run verification: `npm run check && npm run lint && npm test`
- **Ensure API changes remain atomic**

### 4. Update CLAUDE.md (if applicable)

If the feedback represents a pattern Claude should always follow:

**Add to "DO NOT" section:**
```markdown
## DO NOT
- [What Claude did wrong] - [correct approach]
```

**Or update relevant section:**
- Code style issues -> Update "Code Style & Patterns"
- Architecture issues -> Update "Architecture"
- Testing issues -> Update "Testing Requirements"
- FDAM issues -> Update "FDAM Domain Reference"

### 5. Commit the Changes

Create a commit that:
- Fixes the specific feedback
- Includes CLAUDE.md update if made
- References the PR if possible

```bash
git add -A
git commit -m "fix: [description] per PR feedback; update CLAUDE.md"
git push
```

## Example Workflow

**Feedback:** "Use string literal union, not enum"

1. Fix: Change `enum Status { ... }` to `type Status = 'active' | 'inactive'`
2. Verify: `npm run check`
3. Update CLAUDE.md: Already covered in "DO NOT" section
4. Commit: "fix: use string literal union per PR feedback"

**Feedback:** "Threshold doesn't match FDAM spec"

1. Check: RAG-KB/FDAM_v4_METHODOLOGY.md for correct value
2. Fix: Update threshold to match FDAM
3. Verify: `npm run check && npm test`
4. Update CLAUDE.md: Add note to FDAM Domain Reference if needed
5. Commit: "fix(fdam): correct ash/char threshold to 150/cm2"

## Output

- What was changed
- Whether CLAUDE.md was updated and why
- Verification results
- Confirmation changes are ready for re-review
- **Evidence-based next steps**
