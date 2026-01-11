# /review - Code Review

Review the current changes and provide feedback.

## Pre-compute context
```bash
git diff --stat
git diff HEAD~1..HEAD --name-only 2>/dev/null || git diff --staged --name-only
git log -1 --oneline 2>/dev/null || echo "No commits yet"
```

## Instructions

Review the code changes with focus on:

### 1. Correctness
- Does the code do what it's supposed to do?
- Are there edge cases not handled?
- Are there potential bugs or race conditions?
- **Do calculations match FDAM thresholds?**

### 2. Code Quality
- Is the code readable and maintainable?
- Are names clear and descriptive?
- Is there unnecessary complexity?
- **Are Result types used for error handling?**
- **Are Zod schemas defined for API contracts?**

### 3. Patterns & Consistency
- Does it follow project conventions (check CLAUDE.md)?
- Are there better patterns that could be used?
- Is it consistent with the rest of the codebase?
- **No enums - using string literal unions?**

### 4. Testing
- Are there tests for the changes?
- Do tests cover edge cases?
- Are tests maintainable?
- **Vitest for unit, Playwright for browser?**

### 5. Security
- Any potential security issues?
- Proper input validation via Zod?
- No exposed secrets?

### 6. FDAM Compliance
- Does terminology match FDAM methodology?
- Are zone/phase names correct?
- Do thresholds match regulatory standards?
- Is the logic consistent with RAG-KB/FDAM_v4_METHODOLOGY.md?

### 7. Full-Stack Integrity
- Are API changes atomic (frontend + backend)?
- Do Zod schemas match between layers?
- Are Result types consistent?

## Output Format

```markdown
## Code Review

### Summary
[One paragraph overview]

### FDAM Compliance
[Notes on methodology alignment]

### Full-Stack Contract
[Notes on API integrity]

### What's Good
- [Positive feedback]

### Suggestions
- [File:Line] - [Suggestion]

### Issues to Address
- [File:Line] - [Issue and why it matters]

### Optional Improvements
- [Nice-to-have changes]

### Verdict
APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION
```

## Guidelines

- Be constructive, not critical
- Explain *why* something is an issue
- Suggest specific fixes
- Acknowledge good code
- Prioritize issues by severity
- **Always check FDAM alignment for domain code**

## Next Steps

Based on review:
- If APPROVE: Ready for `/commit-push-pr`
- If REQUEST_CHANGES: Use `/fix-errors` then re-review
