# library — the personal cinema record

Your Library is a *view* over things other slices own: the diary owns viewings,
ratings owns opinions, reviews owns writing, watchlist owns intent. Nothing is
stored for the Library itself.

- **`LibraryTabs.tsx`** — the tab frame. Four tabs, underlined in tape red.
- **`DiaryTab.tsx`** — every viewing, grouped by year. A dense dated table, not a
  poster wall: this is a record, and you scan it for *when*.
- **`RatingsTab.tsx`** — a poster grid; here you scan by film.
- **`ReviewsTab.tsx`** — your writing, each with the rating it came with.
- **`WatchlistTab.tsx`** — films you mean to watch. Logging one removes it.
- **`EmptyState.tsx`** — every empty tab points at the action that fills it. An
  empty diary is the most common first screen in the app, so it has to say what
  to do next rather than just report absence.
