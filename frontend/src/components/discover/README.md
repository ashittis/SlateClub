# discover components — the "find something to watch" surfaces

The browsable discovery UI: rows of recommended films, "movies like X" answers, and the
filter modal. Cards are the primary unit, posters treated as album art.

## Components
- **`DiscoverRows.tsx`** — the stack of horizontally-scrolling recommendation rows
  (trending, "because you liked…", etc.).
- **`RankedRow.tsx`** — a single ranked row of film cards with its reason label.
- **`MoviesLikeSection.tsx`** — the "movies like ___" section that seeds a similarity query.
- **`SimilarAnswer.tsx`** — renders the result of a "something like X" query (the similar-films answer).
- **`MovieFilterModal.tsx`** — the filter sheet (mood/genre/language/platform/era chips).
- **`GenreMoodTileGrid.tsx`** — Search default-state colored browse tiles (pill-taxonomy colours).
- **`SearchFilterBar.tsx`** — Type/Year filter chips + `applyFilters()` helper for film results.
- **`PeopleResults.tsx`** — the People tab of Search, backed by `/api/users/search` (UserChip rows).

## Notes
- Rows scroll horizontally on touch; chips are colour-coded by category. Enter/exit and row
  reveals use Framer Motion.
- Calls the discovery/recommendation API (`/discover`, similar-films endpoints).
