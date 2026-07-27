# Slates components — curated film lists (playlists for movies)

"Slates" are SlateClub's collections — think Spotify playlists, but for films. These components create them, add titles to them, display them as poster-collage cards, and host a live discussion room inside each one.

## Components
- **`SlateCard.tsx`** — the collection tile for grids: a fanned/mosaic/spiral poster collage (via `CardStack`), title, creator, film count, and save count. Links to the slate detail page.
- **`CreateSlateModal.tsx`** — bottom-sheet/modal to make a new slate: title, description, Public/Private visibility toggle, and a collaborator multi-picker. Posts to `/api/slates`.
- **`AddToSlateSheet.tsx`** — a sheet that lists the user's slates so they can drop the current film/series into one, or spin up a new slate on the spot (which then auto-adds the title). Reads `/api/slates/mine`, posts to `/api/slates/:id/films`.
- **`SlateFilmRow.tsx`** — one film inside a slate: poster, title, year · language, an optional curator note, and an optional Remove button.
- **`SlateRoom.tsx`** — the per-slate chat: a scrolling message list with avatars and relative timestamps, plus a composer. Polls `/api/slates/:id/room` every 30s and posts new messages there.
- **`SlateProgressCard.tsx`** — compact rail card (cover + optional "N/total watched" bar) for Home's "Continue your Slates" row.
- **`AiSlateModal.tsx`** — AI Slate (Beta) modal: a single "describe the vibe" input that creates a named Slate and opens it (generation is a follow-up).

## Notes
Both the create and add sheets slide up from the bottom on mobile and centre as modals on desktop (`items-end sm:items-center`), with tap-outside-to-close. TanStack Query mutations invalidate the relevant `slates`/`slate`/`slate-room` caches so lists and counts stay in sync. `SlateRoom` uses `AnimatePresence` for message enter animations and near-real-time polling. Cover collages come from the shared `CardStack` primitive. Colours follow the amber CTA-gradient for primary actions.
