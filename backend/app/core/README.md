# core — framework plumbing

Infrastructure every slice depends on and no slice owns. **No product logic here.**

- **`config.py`** — all settings, read from `backend/.env` via pydantic-settings.
  The only place the app reads the environment; never call `os.getenv` elsewhere.
  Every external service is optional and availability-gated.
- **`database.py`** — the async engine, `Base`, and the `get_db` dependency
  (commits on success, rolls back on exception).
- **`auth.py`** — password hashing, JWT issue/verify, and `get_current_user`.
  Tokens ride in httpOnly cookies; `samesite=none` in production for cross-origin.
- **`redis_client.py`** — optional warm cache, namespaced under `kaset:` on DB index 1.
  Everything degrades to in-process compute when Redis is unreachable.
