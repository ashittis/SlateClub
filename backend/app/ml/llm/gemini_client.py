"""Thin wrapper around the Gemini API.

Two surfaces:
- `generate_json(prompt, schema)` — structured LLM extraction (used for
  MovieIdentity, taste statements, persona generation).
- `embed(text, task_type)` — text embedding for semantic search.

Both gracefully degrade to None / empty when GEMINI_API_KEY is unset,
so the rest of the system can decide what to do (typically: fall back
to the genre-vector path).
"""

from __future__ import annotations

import json

import numpy as np

from ...core.config import settings

try:
    import google.generativeai as genai

    _HAS_GEMINI = True
except ImportError:
    _HAS_GEMINI = False
    genai = None  # type: ignore


_configured = False


def _ensure_configured() -> bool:
    global _configured
    if _configured:
        return True
    if not _HAS_GEMINI or not settings.GEMINI_API_KEY:
        return False
    genai.configure(api_key=settings.GEMINI_API_KEY)
    _configured = True
    return True


def is_available() -> bool:
    return _ensure_configured()


async def generate_text(
    prompt: str,
    *,
    model: str | None = None,
    temperature: float = 0.5,
    max_output_tokens: int = 400,
) -> str | None:
    """Plain-text generation. Returns the response text or None."""
    if not _ensure_configured():
        return None
    model_name = model or settings.GEMINI_LLM_MODEL
    client = genai.GenerativeModel(
        model_name,
        generation_config={
            "temperature": temperature,
            "max_output_tokens": max_output_tokens,
        },
    )
    try:
        resp = await client.generate_content_async(prompt)
    except Exception as exc:
        print(f"[gemini.generate_text] call failed: {exc}")
        return None
    text = (resp.text or "").strip() if hasattr(resp, "text") else ""
    return text or None


async def generate_json(
    prompt: str,
    *,
    response_schema: dict | None = None,
    model: str | None = None,
    temperature: float = 0.4,
) -> dict | None:
    """Call Gemini with JSON-mode output. Returns parsed dict or None.

    `response_schema` is an optional Gemini JSON schema (Type-style
    dict). When provided, output is constrained to that shape.
    """
    if not _ensure_configured():
        return None

    model_name = model or settings.GEMINI_LLM_MODEL
    generation_config: dict = {
        "response_mime_type": "application/json",
        "temperature": temperature,
    }
    if response_schema is not None:
        generation_config["response_schema"] = response_schema

    client = genai.GenerativeModel(model_name, generation_config=generation_config)
    try:
        resp = await client.generate_content_async(prompt)
    except Exception as exc:
        print(f"[gemini.generate_json] call failed: {exc}")
        return None

    text = (resp.text or "").strip() if hasattr(resp, "text") else ""
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        print(f"[gemini.generate_json] JSON parse failed: {exc}; raw={text[:200]}")
        return None


async def embed(
    text: str,
    *,
    task_type: str = "RETRIEVAL_DOCUMENT",
    model: str | None = None,
) -> np.ndarray | None:
    """Embed text with Gemini. Returns float32 numpy array or None.

    task_type: RETRIEVAL_DOCUMENT for indexed content (movies),
    RETRIEVAL_QUERY for search queries (user taste statements).
    """
    if not _ensure_configured() or not text:
        return None
    model_name = model or settings.GEMINI_EMBED_MODEL
    try:
        # The SDK's embed_content is sync; for our offline batch usage
        # this is fine. If we ever need async we'd run it in a worker.
        resp = genai.embed_content(
            model=model_name,
            content=text,
            task_type=task_type,
        )
    except Exception as exc:
        print(f"[gemini.embed] call failed: {exc}")
        return None

    values = resp.get("embedding") if isinstance(resp, dict) else None
    if not values:
        return None
    return np.array(values, dtype=np.float32)


def serialize_embedding(vec: np.ndarray) -> bytes:
    """Pack an embedding for storage in a LargeBinary column."""
    return vec.astype(np.float32).tobytes()


def deserialize_embedding(blob: bytes | None) -> np.ndarray | None:
    if not blob:
        return None
    return np.frombuffer(blob, dtype=np.float32)
