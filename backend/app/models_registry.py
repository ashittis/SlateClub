"""Imports every SQLAlchemy model module so Base.metadata is fully
populated before create_all / Alembic autogenerate. Import side-effects only.

Any new model module MUST be listed here, or Alembic will silently miss the
table and the migration will never build it.
"""

from app.shared.models import (  # noqa: F401
    user,
    movie,
    actions,
    social,
    onboarding,
    messaging,
    collections,
    reddit_cache,
    discovery_cache,
    discovery_evidence,
)
from app.features.notifications import models as _notifications_models  # noqa: F401
