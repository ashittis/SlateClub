# backend/app — architecture map

The FastAPI backend is organised as **vertical feature slices**. Each user-facing
"option" (discovery, match-cut, community, recommendation, onboarding, …) lives in
its own folder under `features/`, holding that feature's API routes plus the models
and services only it owns. Anything shared by many features lives in `shared/`,
`core/`, `ml/`, or `integrations/`.

```
app/
  main.py            FastAPI app: CORS, startup table-create, router registration
  models_registry.py imports every model module so Base.metadata is fully populated
  routes/__init__.py the router registry — collects one router per feature into all_routers

  core/         shared infrastructure  → auth (JWT), config, database, redis, neo4j
  integrations/ external API clients    → tmdb (catalog/posters), reddit (discussions)
  ml/           the recommendation engine → embeddings, graph, llm, models, pipeline, eval

  shared/
    models/     the heavily-shared tables (user, movie, actions, social, onboarding, caches)
    services/   cross-cutting business logic (notify, taste_cache, watch_signals, …)

  features/     one folder per feature slice, each with its routes + owned models/services
    auth/ users/ movies/ ratings/ discovery/ recommendation/ match_cut/
    community/ onboarding/ artists/ releases/ watch_parties/ slates/
    notifications/ activity/ imports/
```

## How a request flows

1. `main.py` builds the FastAPI app and includes every router from `routes/__init__.py`.
2. Each router lives in a feature slice, e.g. `features/discovery/discover.py`.
3. A route depends on `core.auth.get_current_user` + `core.database.get_db`, reads/writes
   models (feature-owned or from `shared/models`), and calls `shared/services` or `ml/`
   for anything beyond simple CRUD.
4. Responses are Pydantic-serialised movie/user payloads.

## Why some things are shared, not sliced

`user`, `movie`, `actions`, `social`, and `onboarding` models are imported by 8–41 files
each — they are the connective tissue of the whole app. Splitting them into slices would
force every feature to cross-import, so they live in `shared/models/`. Likewise `notify`,
`taste_cache`, `watch_signals`, and `diary_service` are used by several features and live
in `shared/services/`. See each folder's own README for detail.

## Conventions

- **Imports are absolute** (`from app.shared.models.movie import Movie`), never relative.
- **Add a route:** put it in the right `features/<slice>/`, then register its router in
  `routes/__init__.py`.
- **Add a model:** add it under the owning slice (or `shared/models/` if broadly shared),
  and add its module to `models_registry.py` so its table is created.
- **Migrations:** Alembic's `env.py` imports `models_registry`, so new tables are picked up
  by autogenerate.
