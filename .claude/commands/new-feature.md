# /new-feature - Plan and Implement New Feature

Plan and implement a new feature with full verification.

## Pre-compute context
```bash
# Project structure
find . -type f \( -name "*.ts" -o -name "*.tsx" \) | grep -v node_modules | head -30

# Recent patterns
git log --oneline -10

# FDAM reference
head -100 RAG-KB/FDAM_v4_METHODOLOGY.md 2>/dev/null || echo "FDAM doc not found"
```

## Instructions

### Phase 1: Planning (Plan Mode) - MANDATORY

Before writing any code:

1. **Understand the requirement**
   - What exactly should this feature do?
   - Who uses it and how?
   - What are the acceptance criteria?
   - **How does this relate to FDAM phases/workflow?**

2. **Analyze the codebase**
   - Where should this code live?
   - What existing code can be reused?
   - What patterns are already established?
   - **Check RAG-KB/FDAM_v4_METHODOLOGY.md for domain requirements**

3. **Design the solution**
   - What files need to be created/modified?
   - What's the data flow?
   - **What Zod schemas are needed?**
   - **Is this full-stack (frontend + backend)?**
   - How will it be tested (Vitest + Playwright)?

4. **Validate against Development Pillars**
   - [ ] Plan based ONLY on empirical evidence
   - [ ] No duplication of existing functionality
   - [ ] Appropriate complexity
   - [ ] Full stack considerations addressed
   - [ ] Testing strategy included
   - [ ] Code reuse maximized
   - [ ] FDAM alignment verified

5. **Present the plan**
   - List all files to create/modify
   - Describe the implementation approach
   - Include Zod schema definitions
   - Identify potential risks
   - Note FDAM compliance considerations

**Wait for approval before proceeding to Phase 2.**

### Phase 2: Implementation

Once plan is approved:

1. Create/modify files according to plan
2. Follow project conventions (see CLAUDE.md)
3. Use Result types for error handling
4. Create Zod schemas for API contracts
5. Write tests alongside implementation
6. Run `npm run check` after each significant change
7. **Ensure API changes are atomic (frontend + backend together)**

### Phase 3: Verification

1. Run full verification:
   ```bash
   npm run check
   npm run lint
   npm test
   npm run test:e2e 2>/dev/null || echo "E2E not configured"
   ```

2. Test the feature manually (use `--host` for WSL access)

3. Review the changes:
   - Does it match the plan?
   - Is the code clean?
   - Are tests comprehensive?
   - **Does it align with FDAM methodology?**

### Phase 4: Cleanup

1. Run code simplifier if needed (`@code-simplifier`)
2. Update documentation if necessary
3. Prepare commit message

## Output

End with:
- Summary of what was built
- Files created/modified
- How to test the feature
- FDAM compliance notes
- **Evidence-based next steps recommendation**
