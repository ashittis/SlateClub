# Taste-engine components — the "something like ___" seed picker

This folder holds the entry point to the essence/similarity engine — the "Show me something like [film]" builder. The user anchors on one title and the engine returns films/series matched by tone, tension, and moral world rather than genre. (The constellation/bubble result visualisation and answer stepper live alongside it in the parent page and `SimilarAnswer`.)

## Components
- **`MoviesLikeBuilder.tsx`** — the seed-picker card. Type a film or series name, choose the exact title from a live autocomplete (films and series interleaved, best-rated first), then hit "Show me →" to run it through the engine. The chosen title becomes an amber poster chip you can clear; the input debounces at ~250ms and searches `/api/movies/search` and `/api/series/search`. Controlled `value`/`onClear` let the page restore the seed after a refresh.

## Notes
The card is deliberately conversational — the prompt reads as a sentence with the picker inline. `AnimatePresence` fades the autocomplete dropdown in/out; the picked title chip uses the amber mood colour to signal it's the active anchor. Search only fires at ≥2 characters and is cached 60s. The builder is presentational: it hands the picked film up via `onSubmit`, and the parent runs the recommendation call and renders the results. Full-width and touch-friendly on mobile, with a comfortable 3rem-tall input and large tap targets in the results list.
