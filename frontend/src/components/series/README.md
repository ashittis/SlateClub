# Series components — rating TV shows season by season, episode by episode

These handle the extra structure that TV series need over films: per-season star ratings, per-episode 1–10 scores and quick reactions, an aggregated summary, and season-scoped reviews. Together they let a user grade a show at whatever depth they care about.

## Components
- **`SeasonAccordion.tsx`** — one collapsible season block with its own star rating; expanding it lazy-loads that season's episodes and renders an `EpisodeRow` for each. Saves via `POST /api/series/:id/season/:n/rate`.
- **`EpisodeRow.tsx`** — a single episode: still image, title, overview, community score, plus the user's numeric rating and reaction controls. Persists each change immediately via the episode `rate` and `reaction` endpoints.
- **`NumericRating.tsx`** — a compact IMDb-style 1–10 picker (small numbered buttons); clicking the current value clears it. Deliberately lightweight so it doesn't compete with the big star widget.
- **`EpisodeReactionPicker.tsx`** — quick emoji reaction chips (🔥 Peak, 😭 Devastating, 🤯 Mind-blowing, 💤 Slow). Toggle on/off, no review needed.
- **`SeriesRatingSummary.tsx`** — an aggregate card: Overall / Season-avg / Episode-avg scores plus per-season progress bars. Animates the bars in; shows a prompt when nothing is rated yet.
- **`SeriesReviews.tsx`** — written reviews scoped by a "Whole series / Season N" selector, with a compose box. Reads/writes `/api/reviews/*` (no episode-level reviews).

## Notes
State is kept fresh with TanStack Query mutations that invalidate the `series-my-ratings` query, so ratings update across the page instantly. Episodes load only when a season is expanded (perf). Motion is restrained — animated summary bars, simple transitions. Season star ratings reuse the shared `StarRating` widget. Reaction/numeric controls use touch-friendly chips and buttons; still thumbnails hide on the narrowest screens.
