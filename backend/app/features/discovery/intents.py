"""Search intents — how we ask the world what to watch after a film.

Discovery starts by asking real questions in the places people answer them
(KASET.md §9). Each intent phrases the same underlying question differently
because different phrasings surface different threads and different articles;
one query would give one community's answer.

These are templates, not prompts. Nothing here reaches an LLM — they go to
Reddit search and Brave.
"""

REDDIT_INTENTS = (
    'movies like "{title}"',
    'films similar to "{title}"',
    'what to watch after "{title}"',
    '"{title}" recommendations',
    'if you liked "{title}"',
)

WEB_INTENTS = (
    "movies like {title} {year}",
    "films similar to {title}",
    "if you liked {title} watch next",
    "{title} readalike recommendations list",
)


def reddit_queries(title: str, year: str | None = None) -> list[str]:
    year_q = f" {year}" if year else ""
    return [t.format(title=title) + (year_q if "recommendations" in t else "") for t in REDDIT_INTENTS]


def web_queries(title: str, year: str | None = None) -> list[str]:
    return [t.format(title=title, year=year or "").strip() for t in WEB_INTENTS]
