from app.features.activity.routes import router as activity_router
from app.features.auth.routes import router as auth_router
from app.features.community.comments import router as comments_router
from app.features.ratings.feedback import router as feedback_router
from app.features.users.follows import router as follows_router
from app.features.movies.movies import router as movies_router
from app.features.movies.series import router as series_router
from app.features.discovery.search import router as search_router
from app.features.onboarding.routes import router as onboarding_router
from app.features.ratings.ratings import router as ratings_router
from app.features.ratings.reviews import router as reviews_router
from app.features.users.users import router as users_router
from app.features.ratings.watch_history import router as watch_history_router
from app.features.ratings.watchlist import router as watchlist_router
from app.features.recommendation.recommendations import router as recommendations_router
from app.features.recommendation.anchors import router as anchors_router
from app.features.recommendation.tribes import router as tribes_router
from app.features.recommendation.taste import router as taste_router
from app.features.recommendation.taste_engine import router as taste_engine_router
from app.features.discovery.feed import router as feed_router
from app.features.discovery.discover import router as discover_router
from app.features.discovery.consensus import router as consensus_router
from app.features.slates.routes import router as slates_router
from app.features.community.discourse import router as discourse_router
from app.features.notifications.routes import router as notifications_router
from app.features.artists.routes import router as artists_router
from app.features.releases.releases import router as releases_router
from app.features.releases.cultural import router as cultural_router
from app.features.community.festivals import router as festivals_router
from app.features.releases.theatres import router as theatres_router
from app.features.watch_parties.routes import router as watch_parties_router
from app.features.community.circles import router as circles_router
from app.features.community.chapters import router as chapters_router
from app.features.ratings.critics import router as critics_router
from app.features.imports.routes import router as imports_router
from app.features.community.posts import router as posts_router
from app.features.match_cut.routes import router as match_cut_router
from app.features.users.orbits import router as orbits_router
from app.features.community.dms import router as dms_router
from app.features.community.chat import router as chat_router
from app.features.ratings.diary import router as diary_router
from app.features.ratings.wrapped import router as wrapped_router

all_routers = [
    auth_router,
    movies_router,
    series_router,
    search_router,
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
    consensus_router,
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
    posts_router,
    match_cut_router,
    orbits_router,
    dms_router,
    chat_router,
    diary_router,
    wrapped_router,
]
