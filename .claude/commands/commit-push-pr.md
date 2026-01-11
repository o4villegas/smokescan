# /commit-push-pr - Commit, Push, and Create PR

Commit current changes, push to remote, and create a pull request.

## Pre-compute context
```bash
git status --short
git diff --stat
git branch --show-current
```

## Instructions

### Step 1: Pre-Commit Verification

Before committing, ensure:
```bash
npm run check
npm run lint
npm test
```

If any fail, use `/fix-errors` first.

### Step 2: Review Changes

Review the staged and unstaged changes shown above.

### Step 3: Generate Commit Message

Generate a concise, descriptive commit message following conventional commits:
- `feat:` for new features
- `fix:` for bug fixes
- `refactor:` for code changes that neither fix bugs nor add features
- `docs:` for documentation changes
- `test:` for adding or updating tests
- `chore:` for maintenance tasks

**Include FDAM context if relevant:**
- `feat(fdam): add PRV phase sample collection`
- `fix(threshold): correct ash/char clearance value`

### Step 4: Stage and Commit

```bash
git add -A
git commit -m "[generated message]"
```

### Step 5: Push

```bash
git push -u origin HEAD
```

### Step 6: Create PR

Using GitHub CLI:
```bash
gh pr create --fill --web
```

If `gh` is not available, provide the GitHub URL for creating a PR manually.

**PR Description should include:**
- Summary of changes
- FDAM compliance notes (if applicable)
- Testing performed
- Any deployment considerations

## Output

Provide a summary of:
- What was committed
- The commit message used
- PR URL or instructions
- **Next steps recommendation**

## Deployment Model - CRITICAL

**Deployment = git push to GitHub**
- Cloudflare Workers **auto-deploys** when changes are pushed to GitHub
- There is NO manual `wrangler deploy` step
- Pushing to GitHub IS deploying to production

**Post-Push Protocol:**
1. After push completes, inform user that Cloudflare will auto-deploy
2. **Request build logs from user** to confirm successful deployment
3. Do NOT mark deployment complete until build logs are reviewed
4. If deployment fails, investigate logs before making any fixes
