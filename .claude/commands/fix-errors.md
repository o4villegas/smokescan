# /fix-errors - Fix All Errors

Automatically fix typecheck, lint, and test errors.

## Pre-compute context
```bash
npm run check 2>&1 | tail -50
npm run lint 2>&1 | tail -50
npm test 2>&1 | tail -50
```

## Instructions

1. Analyze the errors shown above
2. Group errors by file and type
3. Fix errors in order of dependency (types first, then lint, then tests)
4. After each fix, re-run the relevant check to verify
5. Continue until all checks pass

## Strategy

### Type Errors
- Fix the root cause, not symptoms
- Check imports and type definitions
- Verify Zod schemas match expected types
- Ensure Result types are used correctly

### Lint Errors
- Use auto-fix where possible: `npm run lint -- --fix`
- Then fix remaining manually
- Check for unused imports/variables

### Test Failures - CRITICAL PROTOCOL

**BEFORE attempting to fix any test:**

1. **STOP and investigate** with 100% confidence
2. Determine if the error is in:
   - The test itself, OR
   - The main application code
3. **Confirm with user** before proceeding
4. If error is in main application: remediate the application code
5. Only fix tests when confirmed the test itself is incorrect

**Never assume the test is wrong - investigate the application code first.**

## SmokeScan-Specific Checks

When fixing errors:
- Preserve FDAM terminology (zones, phases, thresholds)
- Maintain Zod schema validation
- Keep Result type error handling pattern
- Ensure API contracts remain atomic (frontend + backend)

## Output

For each error fixed:
- File and line
- What was wrong
- How it was fixed
- Whether it was test vs application code

End with:
- Verification that all checks now pass
- **Next steps recommendation**
