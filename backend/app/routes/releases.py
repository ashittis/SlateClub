"""
Releases API — Phase 3.2

Upcoming releases (theatre + streaming) and per-film countdowns.
For now we read from the `releases` table — populate via TMDB
release_dates ingest job (deferred to ops).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..models.releases import Release
from ..services.releases import upcoming_calendar

router = APIRouter(prefix="/api/releases", tags=["releases"])


@router.get("/calendar")
async def calendar(db: AsyncSession = Depends(get_db)):
    """Upcoming theatrical releases (next ~month) across ALL languages,
    grouped by release date. Powers the Releases page calendar + the
    Upcoming/Biggies × Week/Month panel (derived client-side)."""
    return await upcoming_calendar(db)


@router.get("/upcoming")
async def upcoming(
    region: str = Query("IN"),
    days: int = Query(30, ge=1, le=180),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days)
    rows = (
        await db.execute(
            select(Release)
            .where(Release.region == region)
            .where(Release.release_date >= now)
            .where(Release.release_date <= end)
            .order_by(Release.release_date.asc())
            .limit(120)
        )
    ).scalars().all()
    return {
        "items": [
            {
                "id": r.id,
                "tmdbId": r.tmdb_id,
                "title": r.title,
                "posterPath": r.poster_path,
                "platform": r.platform,
                "releaseDate": r.release_date.isoformat(),
                "daysUntil": max(0, (r.release_date - now).days),
            }
            for r in rows
        ]
    }


@router.get("/film/{tmdb_id}")
async def releases_for_film(
    tmdb_id: int,
    region: str = Query("IN"),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(Release)
            .where(Release.tmdb_id == tmdb_id)
            .where(Release.region == region)
            .order_by(Release.release_date.asc())
        )
    ).scalars().all()
    now = datetime.now(timezone.utc)
    return {
        "items": [
            {
                "platform": r.platform,
                "releaseDate": r.release_date.isoformat(),
                "daysUntil": (r.release_date - now).days,
                "released": r.release_date <= now,
            }
            for r in rows
        ]
    }
