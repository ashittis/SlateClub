"""Thin async LLM wrapper — the only place the app talks to a language model.

Kaset uses an LLM for exactly two jobs, both inside the discovery engine:

  1. Candidate extraction — read collected evidence, return structured film titles.
  2. Final evaluation    — rank an evidence-backed pool and explain the top five.

Both need structured JSON, so `generate_json` is the primary surface;
`generate_text` exists for the rare free-text case.

The LLM never invents recommendations. It only ever reads evidence we
collected and ranks a pool we resolved through TMDB. See KASET.md §9.

Every call degrades to `None` when no API key is configured, so discovery
falls back to serving whatever is already cached rather than failing the
request. Callers must handle `None`.

Model and key come from settings (`LLM_MODEL`, `LLM_API_KEY`). Swap the
model in `.env` without touching code.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.config import settings

try:
    from openai import AsyncOpenAI

    _HAS_SDK = True
except ImportError:  # pragma: no cover - optional dependency
    _HAS_SDK = False
    AsyncOpenAI = None  # type: ignore

logger = logging.getLogger(__name__)

_client: Any = None  # lazily built, reused process-wide


def _get_client() -> Any:
    global _client
    if _client is None and _HAS_SDK and settings.LLM_API_KEY:
        _client = AsyncOpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL or None)
    return _client


def is_available() -> bool:
    """True when a real call can be made. Check this before doing expensive
    prep work for a prompt that would only return None."""
    return bool(_HAS_SDK and settings.LLM_API_KEY)


# Reasoning-style models reject a custom `temperature` and want
# `max_completion_tokens` rather than `max_tokens`. Detect by name prefix so
# the wrapper stays correct as the model is swapped in .env.
_REASONING_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def _is_reasoning_model(name: str) -> bool:
    return name.lower().startswith(_REASONING_PREFIXES)


def _completion_kwargs(*, model: str, temperature: float, max_output_tokens: int | None) -> dict:
    kwargs: dict = {"model": model}
    if _is_reasoning_model(model):
        if max_output_tokens is not None:
            kwargs["max_completion_tokens"] = max_output_tokens
    else:
        kwargs["temperature"] = temperature
        if max_output_tokens is not None:
            kwargs["max_tokens"] = max_output_tokens
    return kwargs


async def generate_text(
    prompt: str,
    *,
    system: str | None = None,
    model: str | None = None,
    temperature: float = 0.5,
    max_output_tokens: int = 400,
) -> str | None:
    """Plain-text generation. Returns the response text, or None on any failure."""
    client = _get_client()
    if client is None:
        return None

    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    kwargs = _completion_kwargs(
        model=model or settings.LLM_MODEL,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )
    try:
        resp = await client.chat.completions.create(messages=messages, **kwargs)
    except Exception as exc:  # noqa: BLE001 - never let a provider error escape
        logger.warning("llm.generate_text failed: %s", exc)
        return None

    return (resp.choices[0].message.content or "").strip() or None


async def generate_json(
    prompt: str,
    *,
    response_schema: dict | None = None,
    system: str | None = None,
    model: str | None = None,
    temperature: float = 0.2,
) -> dict | None:
    """JSON-mode generation. Returns a parsed dict, or None on any failure.

    `response_schema` is inlined into the prompt as an explicit instruction
    rather than passed as strict `json_schema`, so the same schema works
    across providers without reformatting.

    A returned dict is *shape-unverified* — the model may comply loosely.
    Callers must validate before trusting it. In discovery this matters:
    extracted titles are resolved through TMDB and unresolved ones dropped,
    and evaluator output is filtered against the candidate pool in code.
    """
    client = _get_client()
    if client is None:
        return None

    full_prompt = prompt
    if response_schema is not None:
        full_prompt = (
            f"{prompt}\n\nReturn ONLY a JSON object matching this schema. "
            "No markdown fences, no prose.\n\nSchema:\n"
            f"{json.dumps(response_schema, indent=2)}"
        )

    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": full_prompt})

    kwargs = _completion_kwargs(
        model=model or settings.LLM_MODEL,
        temperature=temperature,
        max_output_tokens=None,
    )
    try:
        resp = await client.chat.completions.create(
            messages=messages,
            response_format={"type": "json_object"},
            **kwargs,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("llm.generate_json failed: %s", exc)
        return None

    text = (resp.choices[0].message.content or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("llm.generate_json parse failed: %s; raw=%s", exc, text[:200])
        return None
