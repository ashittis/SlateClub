"""The router registry — the one place that knows every route group.

This file holds no endpoints. Each router declares its own `/api/...` prefix
in its owning feature slice; `main.py` includes them all verbatim.

To add a route group: create it under `app/features/<slice>/`, import it
here, and add it to `all_routers`.
"""

from app.features.auth.routes import router as auth_router
from app.features.blends.routes import router as blends_router
from app.features.diary.routes import router as diary_router
from app.features.discovery.routes import router as discovery_router
from app.features.discovery.search import router as search_router
from app.features.films.routes import router as films_router
from app.features.imports.routes import router as imports_router
from app.features.notifications.routes import router as notifications_router
from app.features.onboarding.routes import router as onboarding_router
from app.features.passport.routes import router as passport_router
from app.features.ratings.ratings import router as ratings_router
from app.features.ratings.watch_history import router as watch_history_router
from app.features.ratings.watchlist import router as watchlist_router
from app.features.passport.wrapped import router as wrapped_router
from app.features.reviews.routes import router as reviews_router
from app.features.social.activity import router as activity_router
from app.features.social.follows import router as follows_router
from app.features.social.messages import router as messages_router
from app.features.watchlists.routes import router as watchlists_router
from app.features.users.users import router as users_router

all_routers = [
    auth_router,
    onboarding_router,
    films_router,
    search_router,
    discovery_router,
    diary_router,
    ratings_router,
    reviews_router,
    watch_history_router,
    watchlist_router,
    watchlists_router,
    blends_router,
    wrapped_router,
    passport_router,
    users_router,
    follows_router,
    activity_router,
    messages_router,
    notifications_router,
    imports_router,
]
