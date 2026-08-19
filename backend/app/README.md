# app — the Kaset backend

FastAPI organised as **vertical feature slices**. Each user-facing system owns its
routes and its tables in one folder, so a feature is understood (and removed) in one
place. Read `KASET.md` at the repo root for the product definition.

```
core/            config · database · auth        framework plumbing, no product logic
integrations/    tmdb · reddit · websearch · llm  ALL external I/O lives here
shared/
  models/        user · movie                    only the two truly universal tables
  services/      diary_service · notify          cross-cutting logic
features/        one folder per system (see features/README.md)
routes/          __init__.py — the router registry, nothing else
models_registry.py                               imports every model for Base.metadata
alembic/         schema migrations (the sole source of schema truth)
scripts/         offline jobs
```

## Rules
- Absolute `app.*` imports only, never relative.
- Route files stay thin; logic belongs in a service.
- A new model module must be added to `models_registry.py` or Alembic will miss it.
- `diary_service` is the single writer for diary + review + watch_history + ratings.
- No `create_all` at startup. `alembic upgrade head` owns the schema; `alembic check`
  reports drift.
