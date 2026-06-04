from .activity import router as activity_router
from .auth import router as auth_router
from .comments import router as comments_router
from .feedback import router as feedback_router
from .follows import router as follows_router
from .movies import router as movies_router
from .onboarding import router as onboarding_router
from .ratings import router as ratings_router
from .reviews import router as reviews_router
from .users import router as users_router
from .watch_history import router as watch_history_router
from .watchlist import router as watchlist_router
from .recommendations import router as recommendations_router
from .anchors import router as anchors_router
from .tribes import router as tribes_router
from .taste import router as taste_router
from .taste_engine import router as taste_engine_router
from .feed import router as feed_router
from .discover import router as discover_router
from .slates import router as slates_router
from .discourse import router as discourse_router
from .notifications import router as notifications_router
from .artists import router as artists_router
from .releases import router as releases_router
from .cultural import router as cultural_router
from .festivals import router as festivals_router
from .theatres import router as theatres_router
from .watch_parties import router as watch_parties_router
from .circles import router as circles_router
from .chapters import router as chapters_router
from .critics import router as critics_router
from .imports import router as imports_router

all_routers = [
    auth_router,
    movies_router,
    ratings_router,
    watchlist_router,
    watch_history_router,
    users_router,
    onboarding_router,
    reviews_router,
    comments_router,
    follows_router,
    activity_router,
    feedback_router,
    recommendations_router,
    anchors_router,
    tribes_router,
    taste_router,
    taste_engine_router,
    feed_router,
    discover_router,
    slates_router,
    discourse_router,
    notifications_router,
    artists_router,
    releases_router,
    cultural_router,
    festivals_router,
    theatres_router,
    watch_parties_router,
    circles_router,
    chapters_router,
    critics_router,
    imports_router,
]
