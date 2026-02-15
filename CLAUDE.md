# Glue Factory Radio

Internet radio platform: React/TypeScript frontend + Express/Node.js backend.

## Deployment

- **Frontend**: Vercel auto-deploys from `main` branch
- **Backend**: Railway auto-deploys from `main` branch
- Build output in `build/` is committed to the repo (not gitignored)

## Git Worktree Setup

- Main worktree: `/Users/andrewmiller/glue-factory-radio` (always has `main` checked out)
- Conductor worktree: feature branches at `/Users/andrewmiller/conductor/workspaces/glue-factory-radio/singapore`

**You CANNOT `git checkout main` from the Conductor worktree.** Use `git push origin HEAD:main` instead.

## Node.js

Project requires Node 18 (see `.nvmrc`). Always prefix commands with:
```
source ~/.nvm/nvm.sh && nvm use 18
```

## Build

```bash
source ~/.nvm/nvm.sh && nvm use 18 && npm install && npm run build
```

## Commit Conventions

Imperative mood, no prefixes:
- "Fix search field styling and mobile ghost click"
- "Add Node version lock"
- Build-only commits: "Rebuild for [description]"

## Known Issues

`vercel.json` has had recurring merge conflict markers. If found, resolve by keeping:
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
