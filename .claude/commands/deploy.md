# Deploy to Production

Build, commit, and push to main so Vercel (frontend) and Railway (backend) auto-deploy.

## CRITICAL CONSTRAINTS

**Worktree**: This workspace is a git worktree. `main` is checked out at `/Users/andrewmiller/glue-factory-radio`. You CANNOT run `git checkout main` here — it will fail. To get changes onto main, use: `git push origin HEAD:main`

**Node environment**: Node 18 is required but not on PATH. Every npm/node command MUST be prefixed with:
```
source ~/.nvm/nvm.sh && nvm use 18
```

## Step 1: Pre-flight Checks

Run these and report the results:

```bash
git branch --show-current
git status --short
git fetch origin main
git log --oneline origin/main..HEAD
git log --oneline HEAD..origin/main
```

Report: current branch, uncommitted changes, commits ahead/behind origin/main.

If behind origin/main, warn that a rebase will be needed in Step 6.

## Step 2: Check for Merge Conflict Markers

```bash
git grep -l '<<<<<<< ' -- ':!node_modules' ':!.claude' 2>/dev/null || echo "No conflict markers found"
```

If conflict markers are found (especially in `vercel.json`, a known recurring issue):
1. Show the conflicted file contents
2. Ask the user which version to keep
3. For `vercel.json`, the correct resolution is typically:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
4. Stage the resolved file

Do NOT proceed until all conflict markers are resolved.

## Step 3: Commit Source Changes

If there are uncommitted changes from Step 1:

```bash
git add <changed source files>
git commit -m "<descriptive message>"
```

Use imperative mood, no prefixes (e.g., "Fix search field styling", "Add dark mode toggle"). Do NOT use `git add -A` — add specific files to avoid committing secrets or junk.

If no uncommitted changes, skip this step.

## Step 4: Build Production Assets

```bash
source ~/.nvm/nvm.sh && nvm use 18 && npm install && npm run build
```

If the build fails:
1. Show the full error output
2. Common issue: ESLint warnings treated as errors (unused variables/imports)
3. Ask the user how to proceed — fix or abort
4. Do NOT continue if the build failed

## Step 5: Commit Build Artifacts

```bash
git add build/
git status --short
```

If build/ has changes:
```bash
git add build/
git commit -m "Rebuild for <description of what changed>"
```

Follow the project pattern: "Rebuild for [feature/fix description]".

If build/ is unchanged (identical output), skip this step.

## Step 6: Rebase on origin/main if Needed

```bash
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
echo $?
```

- Exit code 0: HEAD includes all of origin/main. Proceed to Step 7.
- Exit code 1: origin/main has commits not in HEAD. Must rebase:

```bash
git rebase origin/main
```

If rebase conflicts:
1. Show conflicted files: `git diff --name-only --diff-filter=U`
2. Show each conflict and ask the user for resolution
3. After resolving: `git add <file>` then `git rebase --continue`
4. Offer `git rebase --abort` as an escape hatch
5. If aborted, STOP the deploy

After a successful rebase, re-run Step 4 and Step 5 (build may be stale).

## Step 7: Push to main

```bash
git push origin HEAD:main
```

If push fails:
- **"non-fast-forward"**: origin/main moved. Go back to Step 6.
- **"permission denied"**: Auth issue. Ask user to check credentials.
- **Other errors**: Show full error, ask user how to proceed.

NEVER force-push without explicit user approval.

## Step 8: Push Feature Branch

```bash
git push origin HEAD --force-with-lease
```

Keeps the remote feature branch in sync. Uses `--force-with-lease` since rebase may have rewritten history.

## Step 9: Report

```bash
git log --oneline -1 origin/main
```

Tell the user:
- **Deployed commit**: hash and message now at origin/main
- **Vercel**: auto-deploying frontend (30-60 seconds). Check https://vercel.com/dashboard
- **Railway**: auto-deploying backend (if server/ files changed). Check https://railway.app/dashboard

## Error Recovery

If anything goes wrong:
1. NEVER force-push or use destructive commands without explicit approval
2. Show current state: `git status`, `git log --oneline -5`
3. Explain what happened and what the options are
4. Let the user decide
