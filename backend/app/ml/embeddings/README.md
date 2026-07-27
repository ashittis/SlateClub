# ml/embeddings — taste vectors

Turns a user (and a film) into a numeric **taste vector** — the common language the rest of
the engine uses to measure "how close is this film to what you like".

## Files
- **`taste_vector.py`** — builds and compares taste vectors: aggregates a user's ratings,
  watches, onboarding seeds, and tone tags into a vector, and provides cosine-similarity
  helpers used by search, feed, match-cut, and the pipeline.

## How it works
A user's actions are weighted (recent + highly-rated count more) and combined with film
tone/style features into a fixed-length vector. Similarity between two vectors (user↔film or
user↔user) drives ranking, "movies like X", and taste-blend matching. Cached via
`shared/services/taste_cache` so it isn't recomputed on every request.
