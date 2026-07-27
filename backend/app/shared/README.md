# shared — models & services used across many features

The pieces that don't belong to any single feature slice because lots of them depend on it.

- **[`models/`](models/)** — the heavily-shared tables: `user`, `movie`, `actions`,
  `social`, `onboarding`, and the caches. Imported by 8–41 files each.
- **[`services/`](services/)** — cross-cutting business logic: `notify`, `taste_cache`,
  `watch_signals`, `diary_service`, `impressions`, `taste_embedding`, `trending`, `geo`,
  `reddit_enrich`.

If something here were pushed into a feature slice, every other feature would have to
cross-import it — so it lives in one common place instead.
