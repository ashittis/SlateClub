"""Imports every SQLAlchemy model module so Base.metadata is fully
populated before create_all / Alembic autogenerate. Import side-effects only."""

from app.shared.models import (  # noqa: F401
    user,
    movie,
    actions,
    social,
    onboarding,
    similar_cache,
    reddit_cache,
)
from app.features.community.models import (  # noqa: F401
    chapters,
    chat,
    circles,
    discourse,
    dms,
    festivals,
    posts,
)
from app.features.releases.models import (  # noqa: F401
    cultural,
    releases,
    theatres,
)
from app.features.artists import models as _artists_models  # noqa: F401
from app.features.match_cut import models as _match_cut_models  # noqa: F401
from app.features.notifications import models as _notifications_models  # noqa: F401
from app.features.slates import models as _slates_models  # noqa: F401
from app.features.watch_parties import models as _watch_parties_models  # noqa: F401
from app.features.recommendation import models as _recommendation_models  # noqa: F401
