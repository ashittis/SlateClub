# film components — the film card and its action sheets

The film card plus the bottom-sheets for logging, recommending, and DNF-ing a film. This is
where a user acts on a specific movie.

## Components
- **`FilmCard.tsx`** — the poster-first film card (the app's core unit).
- **`ToneChips.tsx`** — the mood/tone pill chips shown on a film (amber mood, green genre, …).
- **`LogCompletionBurst.tsx`** — the celebratory burst animation when you mark a film watched.
- **`DNFSheet.tsx`** — "did not finish" sheet: capture why you bailed.
- **`RecommendSheet.tsx`** — share/recommend a film to a friend.
- **`ShelfNoteSheet.tsx`** — add a private note when shelving a film.

- **`ProgressPosterCard.tsx`** — poster with a "% watched" overlay (Home "Jump back in").
- **`MixCollageCard.tsx`** — 2×2 poster-collage "Mix" card with a label (Home "Made for you").
- **`SplitPosterCard.tsx`** — two diagonal half-posters for Match Cut cards.
- **`ExpandableSynopsis.tsx`** — clamp + "Read more" for long overviews (Film Detail).
- **`MoreLikeThisRow.tsx`** — Film Detail similarity rail fed by `/api/taste-engine/similar`.

## Notes
- Sheets slide up from the bottom (mobile-first, ≥44px targets), animated with Framer Motion.
- `LogCompletionBurst` is a one-shot particle/scale animation on completion.
- Calls ratings/watch-history/dms endpoints depending on the sheet.
