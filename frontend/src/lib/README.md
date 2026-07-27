# lib — shared client helpers

Framework-agnostic helpers used across pages and components: the API client, formatting
utilities, and design tokens. No UI here — just logic.

## Files
- **`api.ts`** — the fetch wrapper/client for the FastAPI backend (base URL from
  `NEXT_PUBLIC_API_URL`, credentials/cookies, typed helpers). Used with TanStack Query.
- **`constants.ts`** — app-wide constants.
- **`design-tokens.ts`** — the cinema-dark palette + chip colour tokens in TS form
  (mood=amber, genre=green, language=tan, platform=purple, era=violet).
- **`nav.ts`** — navigation structure/links for the shell.
- **`poster-color.ts`** — derives an accent colour from a poster (for ambient backdrops).
- **`profileFormat.ts`** — formatting helpers for profile stats/labels.
- **`searchHistory.ts`** — local search-history persistence.
- **`shelfReasons.ts`** — the reason labels for "why this is on your shelf".
- **`titleHref.ts`** — builds the correct route/href for a film or series title.

## Notes
Everything the UI needs to talk to the backend or render consistently lives here, so
components stay focused on presentation.
