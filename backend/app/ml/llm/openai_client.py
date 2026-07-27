"""Thin async wrapper around the OpenAI API.

Surfaces match the previous gemini_client one-for-one so callsites only
swap the import path:

  - generate_text(prompt, ...)   → chat.completions.create (single user msg)
  - generate_json(prompt, ...)   → chat.completions.create with
                                   response_format={"type":"json_object"}
                                   and the schema inlined in the prompt
  - embed(text, ...)             → embeddings.create
  - serialize/deserialize_embedding(...) — unchanged float32 bytes

All methods degrade to None when OPENAI_API_KEY is unset, so the rest of
the system can fall back to the genre-vector path without special-casing.

Models come from settings:
  - OPENAI_LLM_MODEL (default "gpt-5.5")
  - OPENAI_EMBED_MODEL (default "text-embedding-3-large", 3072-dim)

If the configured chat model is unavailable, the API will return an error
and these calls will return None — swap to a known-good model
("gpt-4o", "gpt-4-turbo") in .env without touching code.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import numpy as np

from app.core.config import settings

try:
    from openai import AsyncOpenAI

    _HAS_OPENAI = True
except ImportError:
    _HAS_OPENAI = False
    AsyncOpenAI = None  # type: ignore

logger = logging.getLogger(__name__)


_client: Any = None  # AsyncOpenAI instance, lazy-built


def _get_client() -> Any:
    global _client
    if _client is None and _HAS_OPENAI and settings.OPENAI_API_KEY:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def is_available() -> bool:
    return bool(_HAS_OPENAI and settings.OPENAI_API_KEY)


# Reasoning-style models (gpt-5, o1, o3, o4) reject custom `temperature`
# and use `max_completion_tokens` instead of `max_tokens`. Detect by name
# prefix so the wrapper stays correct as the user swaps models in .env.
_REASONING_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def _is_reasoning_model(name: str) -> bool:
    return name.lower().startswith(_REASONING_PREFIXES)


def _build_completion_kwargs(
    *, model: str, temperature: float, max_output_tokens: int | None
) -> dict:
    """Return the kwargs accepted by chat.completions.create for this model."""
    kwargs: dict = {"model": model}
    if _is_reasoning_model(model):
        # Reasoning models: omit temperature (only default supported);
        # cap output with max_completion_tokens (max_tokens is rejected).
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
    """Plain-text generation. Returns the response text or None."""
    client = _get_client()
    if client is None:
        return None
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    kwargs = _build_completion_kwargs(
        model=model or settings.OPENAI_LLM_MODEL,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )
    try:
        resp = await client.chat.completions.create(messages=messages, **kwargs)
    except Exception as exc:  # noqa: BLE001
        logger.warning("openai.generate_text failed: %s", exc)
        return None
    text = (resp.choices[0].message.content or "").strip()
    return text or None


async def generate_json(
    prompt: str,
    *,
    response_schema: dict | None = None,
    system: str | None = None,
    model: str | None = None,
    temperature: float = 0.4,
) -> dict | None:
    """JSON-mode generation. Returns parsed dict or None.

    `response_schema` is optional. When provided, the schema is appended to
    the prompt as an explicit instruction; we use OpenAI's json_object
    mode (not strict json_schema) so any cross-model schema works without
    reformatting.
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

    kwargs = _build_completion_kwargs(
        model=model or settings.OPENAI_LLM_MODEL,
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
        logger.warning("openai.generate_json failed: %s", exc)
        return None

    text = (resp.choices[0].message.content or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("openai.generate_json parse failed: %s; raw=%s", exc, text[:200])
        return None


async def embed(
    text: str,
    *,
    task_type: str = "RETRIEVAL_DOCUMENT",  # kept for API compat; OpenAI ignores
    model: str | None = None,
) -> np.ndarray | None:
    """Embed text. Returns float32 np.ndarray or None.

    `task_type` is preserved for callsite compatibility with the old
    gemini_client surface but has no effect on OpenAI — the same model
    is used for documents and queries.
    """
    client = _get_client()
    if client is None or not text:
        return None
    try:
        resp = await client.embeddings.create(
            model=model or settings.OPENAI_EMBED_MODEL,
            input=text,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("openai.embed failed: %s", exc)
        return None
    values = resp.data[0].embedding if resp.data else None
    if not values:
        return None
    return np.asarray(values, dtype=np.float32)


def serialize_embedding(vec: np.ndarray) -> bytes:
    """Pack an embedding for storage in a LargeBinary column."""
    return np.asarray(vec, dtype=np.float32).tobytes()


def deserialize_embedding(blob: bytes | None) -> np.ndarray | None:
    if not blob:
        return None
    return np.frombuffer(blob, dtype=np.float32)
