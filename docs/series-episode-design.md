# Series / Episode Feature Design

## Status: Approved concept, not yet implemented

## Summary

Add a "series" layer above the existing show structure so that recurring shows can group their episodes under a single series identity. One-off shows remain standalone.

## Agreed Data Model (Option A)

```
series (id, title, description, created_at)
  └── shows (id, series_id [NULLABLE], title, description, episode_number, created_date, ...)
        └── show_tracks (id, show_id, title, filename, duration, track_order, ...)
```

- `series_id = NULL` → standalone show (behaves exactly like current shows)
- `series_id = N` → episode of series N
- `episode_number` → auto-assigned on upload (next in sequence), manually overridable in admin (same pattern as `created_date` override)

## Why Option A over Option B

Option B (self-referential `parent_show_id` on shows table) was considered and rejected. It overloads the `shows` table so a row could be a standalone show, a series parent (no tracks), or an episode (has tracks). Every query and UI path would need to ask "what kind of show is this?" Option A keeps series and shows as distinct entities with clean separation.

## Archive List Behavior

- **Main archive**: stays flat and chronological (`ORDER BY created_date DESC`), same as today. Episodes appear inline with standalone shows. Episodes display with their series context in the name (e.g., "Monday Mix — Episode 3: Late Night Jams" — exact format TBD).
- **Series browse view**: new nav option in the bottom bar. Lists all series. Tapping a series shows a dedicated page with all its episodes sorted by `ORDER BY episode_number ASC`.
- **Standalone shows** (no series) only appear in the main archive, not in the series browse view. No "uncategorized" bucket needed.

## Schema Changes Needed

1. New `series` table (id, title, description, created_at)
2. Add `series_id` (nullable FK → series.id) to `shows` table
3. Add `episode_number` (nullable integer) to `shows` table
4. Consider: series could also have tags (many-to-many via `series_tags`), or episodes could inherit series tags — TBD

## Admin Panel Changes

- New section or tab for creating/managing series (title + description)
- Show upload form gets optional "Series" dropdown (leave blank = standalone)
- Show edit modal gets `episode_number` field (visible only when series is associated)
- Ability to associate/disassociate an existing show with a series after the fact

## Frontend Changes

- Archive list: episode display name includes series context
- New "Series" nav item in bottom bar
- New series browse view (list of series)
- New series detail view (episodes listed by episode_number)
- Search: series should be searchable by name, and series membership could be a filter

## Migration Notes

- All existing shows get `series_id = NULL` and `episode_number = NULL` — they become standalone shows, no behavior change
- Existing unused `playlists` / `playlist_items` tables could be dropped or left alone — they serve a different purpose and shouldn't be repurposed for this

## Staging Environment

### Status: Nearly complete — one env var fix remaining

### URLs

- **Staging frontend**: `https://glue-factory-radio-git-staging-andrews-projects-3ba5733d.vercel.app` (Vercel preview, SSO-protected)
- **Staging backend**: `https://glue-factory-radio-staging.up.railway.app`
- **Production frontend**: `https://gluefactoryradio.com`
- **Production backend**: `https://glue-factory-radio-production.up.railway.app`

### Architecture

- **Frontend (Vercel)**: Preview deployment from `staging` branch. CRA bakes `REACT_APP_API_BASE_URL` at build time, so the staging build is done locally with the staging backend URL and committed to the repo.
- **Backend (Railway)**: Separate "staging" environment in the same Railway project. Has its own database (duplicated from production with 4 shows). Shares the same R2 bucket as production for audio file access.
- **Git branch**: Local branch `andrewbenmiller/show-episode-analysis`, pushed to remote as `staging`.

### What's working

- Staging backend is healthy (`/api/health` responds)
- Staging backend serves show data (`/api/shows` returns 4 shows)
- Staging frontend loads and fetches shows from staging backend
- R2 cloud storage is connected on staging
- CORS is configured: `CORS_ORIGIN` in Railway staging set to the Vercel preview URL
- Production is completely untouched and verified healthy throughout

### What's remaining

1. **Remove `R2_KEY_PREFIX` from Railway staging env vars** — Currently set, causing audio file 404s because it looks for `staging/uploads/filename.mp3` instead of `uploads/filename.mp3` where files actually live. Safe to remove since staging only reads from R2 (no writes that would collide with production).
2. **Verify audio playback works** after removing the prefix.
3. **Set `BACKEND_URL` in Railway staging** to `https://glue-factory-radio-staging.up.railway.app` — so background image URLs point to staging backend instead of falling back to the production default.
4. **Enable app sleeping on Railway staging** to minimize cost when idle.
5. **Before merging to main**: Rebuild frontend without `REACT_APP_API_BASE_URL` (or with production URL) so the committed `build/` directory has the correct production URL baked in. The staging branch's `build/` currently has the staging URL.

### Key learnings

- **Vercel env vars didn't work for CRA**: Even after adding `REACT_APP_API_BASE_URL` scoped to Preview in Vercel and redeploying without cache, `react-scripts build` didn't pick it up. Workaround: build locally with the env var and commit the `build/` output.
- **R2 shared bucket**: Staging reads from the same R2 bucket as production (no prefix). This is fine for read-only access to existing audio. If staging ever needs to upload test files, consider adding a prefix or separate bucket at that point.
- **CORS must match exactly**: Railway `CORS_ORIGIN` must be set to the exact Vercel preview URL (not the production domain).

### Workflow

```
local dev (localhost:3000 + localhost:3001)
  → build locally with REACT_APP_API_BASE_URL=staging-backend-url
  → commit build/ and push to staging branch
  → Vercel auto-deploys preview from staging branch
  → Railway auto-deploys staging environment from staging branch
  → test at Vercel preview URL (SSO-protected)
  → when confident, rebuild with production URL, merge staging → main
  → Vercel + Railway auto-deploy production
  → live at gluefactoryradio.com
```

### Cost

Included in the existing Railway Hobby plan ($5/mo). With app sleeping enabled, staging costs pennies per month for occasional dev use.

## Open Questions

- Exact display name format for episodes in the archive list
- Whether series get their own tags or inherit from episodes
- Series detail page design/layout
