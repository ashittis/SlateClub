# integrations — every external API, and nothing else

All third-party I/O lives behind these wrappers. No route, service, or frontend call
talks to an external API directly. Each module exposes `is_available()` so callers can
degrade instead of failing.

- **`tmdb.py`** — the film catalog: search, detail, credits, videos, people. The only
  source of poster paths and canonical titles. Retries with a shared client.
- **`reddit.py`** — OAuth2 Reddit client. The **primary** discovery evidence source.
  Offline/warmer only — never the request path.
- **`websearch.py`** — Brave Search. The secondary evidence source (film sites, blogs,
  recommendation articles). Warmer only.
- **`llm.py`** — the language model. Used for exactly two jobs, both inside discovery:
  extracting candidate titles from evidence, and ranking the resolved pool. It never
  invents films. Returns `None` when unconfigured, so discovery serves cached results
  rather than failing.
