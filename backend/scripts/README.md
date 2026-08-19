# scripts — offline jobs

Everything expensive happens here, never on the request path.

- **`seed_catalog.py`** — pull popular films from TMDB into `movies`. Idempotent.
- **`seed_demo.py`** — a small hand-picked catalog, no network needed.
- **`enrich_reddit.py`** — cache Reddit discussion per film into `reddit_cache`.
- **`warm_discovery.py`** — build the discovery pool for films: collect evidence,
  extract titles, resolve through TMDB, persist the evidence trail. This is the
  expensive half of discovery (two external sources + two LLM passes per seed).
  Safe to re-run; each pass replaces that seed's evidence.

```bash
python -m scripts.warm_discovery --limit 20
python -m scripts.warm_discovery --tmdb 157336 496243
python -m scripts.warm_discovery --refresh --limit 5
```

Without `--refresh` the warmer skips films it has already done, so repeated runs
make progress instead of redoing the head of the list.
