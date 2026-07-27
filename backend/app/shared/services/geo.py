"""
IP → city resolution for the "Trending in your city" home rail.

Location is derived purely from the request IP (no user-entered field). The
tricky part is local dev: a request from your own browser arrives as
127.0.0.1, which no geo provider can place. So when the caller IP is loopback
or private, we query the provider with *no* IP — it then geolocates the
server's own public egress IP, which on localhost is your real location. That
makes the feature testable in real time from a dev machine.

Provider: ipapi.co (no key needed for low volume). Results are cached
in-process by IP so repeat visits don't spend the rate budget.
"""

from __future__ import annotations

import ipaddress
import time

import httpx
from fastapi import Request

# {ip}/json/ geolocates a specific IP; json/ (no ip segment) geolocates the
# request's own source IP — used for the loopback fallback.
_PROVIDER_FOR_IP = "https://ipapi.co/{ip}/json/"
_PROVIDER_SELF = "https://ipapi.co/json/"
_TTL_SECONDS = 6 * 60 * 60

# ip (or "__self__" for the loopback case) -> (fetched_at, result)
_CACHE: dict[str, tuple[float, "GeoResult | None"]] = {}


class GeoResult(dict):
    """Thin dict wrapper: {city, region, country}."""


def client_ip(request: Request) -> str | None:
    """Best-effort real client IP, honouring a proxy's X-Forwarded-For."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        # Left-most entry is the original client; the rest are proxies.
        return fwd.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    if request.client:
        return request.client.host
    return None


def _is_local(ip: str | None) -> bool:
    if not ip:
        return True
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return addr.is_loopback or addr.is_private or addr.is_link_local


async def resolve_city(ip: str | None) -> GeoResult | None:
    """
    Resolve {city, region, country} for an IP. Loopback/private IPs fall back
    to the server's own public IP (see module docstring). Returns None when
    the provider can't place the address.
    """
    local = _is_local(ip)
    cache_key = "__self__" if local else ip  # type: ignore[assignment]

    cached = _CACHE.get(cache_key)  # type: ignore[arg-type]
    if cached and (time.time() - cached[0]) < _TTL_SECONDS:
        return cached[1]

    url = _PROVIDER_SELF if local else _PROVIDER_FOR_IP.format(ip=ip)

    result: GeoResult | None = None
    try:
        async with httpx.AsyncClient(timeout=6.0) as http:
            resp = await http.get(url, headers={"User-Agent": "SlateClub/1.0"})
        if resp.status_code == 200:
            data = resp.json()
            if not data.get("error") and data.get("city"):
                result = GeoResult(
                    city=data.get("city"),
                    region=data.get("region"),
                    country=data.get("country_name") or data.get("country"),
                )
    except Exception as exc:  # noqa: BLE001 — best-effort, never blocks the page
        print(f"[geo] resolve failed for {ip!r}: {exc}")

    _CACHE[cache_key] = (time.time(), result)  # type: ignore[index]
    return result
