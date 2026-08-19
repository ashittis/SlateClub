"""
Resilient async Redis client (optional).

A lazy singleton: `get_redis()` returns a connected client or ``None``. Callers
must treat ``None`` as "no cache" and fall back to live compute — Redis is a
performance layer, never a hard dependency. If the `redis` package is missing,
the server is unreachable, or a live client drops, we degrade gracefully and
retry the connection at most every 30s.

Keys are namespaced with ``kaset:`` and the connection targets a dedicated
logical DB (see ``REDIS_URL``, default DB 1) so this server can be shared with
other projects without collisions or cross-project ``FLUSHDB``.
"""

import time

from app.core.config import settings

try:  # `redis` is optional — absence simply disables caching.
    from redis import asyncio as aioredis
except ImportError:  # pragma: no cover
    aioredis = None

KEY_PREFIX = "kaset:"
_CHECK_INTERVAL = 30.0  # seconds between reconnect attempts after a failure

_client = None
_available = False
_last_check = 0.0


def _k(name: str) -> str:
    """Namespace a key under the Kaset prefix."""
    return f"{KEY_PREFIX}{name}"


async def get_redis():
    """Return a live async Redis client, or ``None`` if unavailable."""
    global _client, _available, _last_check

    if aioredis is None:
        return None

    now = time.monotonic()

    # Healthy client — verify it's still alive (cheap ping).
    if _client is not None and _available:
        try:
            await _client.ping()
            return _client
        except Exception:
            _available = False
            _last_check = now
            try:
                await _client.aclose()
            except Exception:
                pass
            _client = None

    # Back off between (re)connection attempts.
    if not _available and _client is None and (now - _last_check) < _CHECK_INTERVAL:
        return None

    _last_check = now
    try:
        client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=5,
        )
        await client.ping()
        _client = client
        _available = True
        return _client
    except Exception as exc:
        print(f"[redis] unavailable, using in-process fallback: {exc}")
        _client = None
        _available = False
        return None


async def close_redis():
    """Close the singleton on shutdown."""
    global _client, _available
    if _client is not None:
        try:
            await _client.aclose()
        except Exception:
            pass
    _client = None
    _available = False
