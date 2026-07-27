"""
Now Showing API — Phase 3.5

Theatre listings + showtimes for a film/city. Data ingest is deferred
to a partner integration (Bookmyshow, PVR feed, etc.) — these endpoints
are functional once `theatres` and `showtimes` are populated.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.features.releases.models.theatres import Showtime, Theatre

router = APIRouter(prefix="/api/now-showing", tags=["now-showing"])


@router.get("/film/{tmdb_id}")
async def showtimes_for_film(
    tmdb_id: int,
    city: str = Query(...),
    days: int = Query(2, ge=1, le=7),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days)

    rows = (
        await db.execute(
            select(Showtime, Theatre)
            .join(Theatre, Theatre.id == Showtime.theatre_id)
            .where(Showtime.tmdb_id == tmdb_id)
            .where(Theatre.city.ilike(city))
            .where(and_(Showtime.starts_at >= now, Showtime.starts_at <= end))
            .order_by(Showtime.starts_at.asc())
        )
    ).all()

    return {
        "items": [
            {
                "id": s.id,
                "startsAt": s.starts_at.isoformat(),
                "bookingUrl": s.booking_url,
                "theatre": {
                    "id": t.id,
                    "name": t.name,
                    "chain": t.chain,
                    "city": t.city,
                },
            }
            for s, t in rows
        ]
    }


@router.get("/city/{city}")
async def films_in_city(
    city: str,
    db: AsyncSession = Depends(get_db),
):
    """Distinct tmdb ids currently scheduled in `city` (next 48h)."""
    now = datetime.now(timezone.utc)
    end = now + timedelta(hours=48)
    rows = (
        await db.execute(
            select(Showtime.tmdb_id, Theatre.city)
            .join(Theatre, Theatre.id == Showtime.theatre_id)
            .where(Theatre.city.ilike(city))
            .where(and_(Showtime.starts_at >= now, Showtime.starts_at <= end))
            .distinct()
        )
    ).all()
    return {"tmdbIds": list({r[0] for r in rows})}
