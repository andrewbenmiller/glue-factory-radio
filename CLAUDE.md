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

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Vercel (frontend)         gluefactoryradio.com         │
│  - React/TypeScript SPA                                 │
│  - /api/* serverless functions (live-status proxy)      │
├─────────────────────────────────────────────────────────┤
│  Railway (backend)         *.up.railway.app             │
│  - Express/Node.js API + SQLite                         │
│  - Serves audio files from Cloudflare R2                │
│  - Admin panel at /admin                                │
├─────────────────────────────────────────────────────────┤
│  DigitalOcean Droplet      stream.gluefactoryradio.com  │
│  - Caddy (HTTPS termination, auto Let's Encrypt)        │
│  - Reverse proxies to ShoutStream/Icecast               │
│  - Config lives on the server, NOT in this repo         │
└─────────────────────────────────────────────────────────┘
```

## Audio Signal Flow

The app has two independent audio sources that share one ticker display. Understanding this flow is critical — do not modify these files without reading this section.

**Key files:** `src/audio/AudioProvider.tsx`, `src/components/AudioPlayer.tsx`, `src/App.tsx`, `src/hooks/useLiveStatus.ts`, `src/config/liveStream.ts`

### Audio source state machine (`AudioProvider.tsx`)

```
source: "none" | "track" | "live"

"none"  → User sees ticker: "GLUE FACTORY RADIO" (idle)
"live"  → User sees ticker: "{LIVE_LABEL}: {now_playing}" (from Icecast metadata)
"track" → User sees ticker: "PLAYING NOW: {track_title}" (from archive player)
```

### Transitions

```
LIVE STREAM:
  playLive()  → stops archive (Howler.stop), sets source="live", plays HTML5 Audio
  stopLive()  → pauses HTML5 Audio, sets source="none"

ARCHIVE PLAYER:
  notifyTrackWillPlay() → stops live stream, sets source="track"
  notifyTrackPaused()   → sets source="none" (ticker returns to idle)
  notifyTrackDidStop()  → sets source="none" (track ended or unloaded)
  resumeOrStart()       → if paused mid-track, calls notifyTrackWillPlay + resumes
```

### Live stream polling

- `useLiveStatus.ts` polls `/api/live-status` (Vercel serverless proxy)
- Proxy fetches `https://stream.gluefactoryradio.com/status-json.xsl`
- Returns: `isLive`, `nowPlaying` (artist - title), `listeners`, `streamUrl`
- The ticker label ("LIVE NOW" etc.) is customizable via admin panel (`pageCache.live_label`)

### Ticker display logic (`App.tsx`)

```typescript
tickerDisplayText = useMemo(() => {
  if (source === "live")  → show live label + now playing
  if (source === "track") → show "PLAYING NOW: {track}"
  else                    → show "GLUE FACTORY RADIO"
})
tickerIsEmpty = (source === "none")  // controls ticker styling (red vs white)
```

## Editing Rules

**NEVER use the Write tool to overwrite entire files.** Always use Edit (surgical find-and-replace). Full file writes have caused regressions by overwriting concurrent changes from other sessions.

**Before modifying a file, always read it first** to get the current state — not a cached version from earlier in the session.

**Files that are tightly coupled** (edit one, check the others):
- `AudioProvider.tsx` ↔ `AudioPlayer.tsx` ↔ `App.tsx` (audio state)
- `App.css` ↔ `App.tsx` (class names, layout)
- `liveStream.ts` ↔ `useLiveStatus.ts` ↔ `api/live-status.js` (stream config)

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
