# releases/models — tables owned by the releases slice

| File | Tables |
|---|---|
| `releases.py` | `Release` (an upcoming/recent film release entry) |
| `cultural.py` | `CulturalContext` (background/connections for a film) |
| `theatres.py` | `Theatre`, `Showtime` |

All inherit `Base` from `app.core.database` and are registered in
`app/models_registry.py`. They reference `Movie` (from `shared/models/movie`).
