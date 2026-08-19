# shared/services — cross-cutting logic

Business logic more than one slice needs. Routes stay thin; this is where the rules live.

- **`diary_service.py`** — the **single writer** for the diary/watch-history pair.
  Every diary write upserts the `watch_history` summary; a delete drops that summary
  only when it was the last remaining viewing. No route may write those tables directly.
- **`notify.py`** — the notification writer. `features/notifications/` is the read side.
- **`reddit_enrich.py`** — fetches and caches Reddit discussion per film into
  `reddit_cache`. Offline enrichment, never the request path.
