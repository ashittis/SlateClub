# routes — the router registry

This folder is **not** where route logic lives anymore — the actual endpoints are inside
each `app/features/<slice>/` folder. `__init__.py` here is just the aggregator: it imports
one `router` from every feature slice and exposes them as `all_routers`, which `main.py`
includes into the FastAPI app.

## To add a feature's endpoints
1. Write the routes in `app/features/<slice>/` (a `routes.py`, or named route files).
2. Add `from app.features.<slice>.<module> import router as <name>_router` here and append
   `<name>_router` to the `all_routers` list.
