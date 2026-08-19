"""The evidence-first discovery engine.

The single most important test here is `test_evaluator_discards_films_outside_the_pool`.
Kaset's central promise is that it never recommends a film nobody mentioned
(KASET.md §9), and that promise is kept in code — the evaluator filters its own
output against the resolved pool. If it depended on the model obeying a prompt,
it would not be a promise.

These are unit tests over pure stages: no network, no LLM, no warmer.
"""

import pytest

from app.features.discovery import evaluate as evaluator
from app.features.discovery import intents, rank, resolve, scoring
from app.features.discovery.evidence.schema import Candidate
from app.features.discovery.weights import Weights

pytestmark = pytest.mark.asyncio


def _mention(source="reddit", name="reddit", sentiment="positive", authority=0.7, context="great"):
    return {
        "source": source,
        "source_name": name,
        "sentiment": sentiment,
        "authority": authority,
        "context": context,
    }


def _candidate(tmdb_id=1, title="A Film", mentions=1, **kw):
    return Candidate(
        tmdb_id=tmdb_id,
        title=title,
        mentions=[_mention() for _ in range(mentions)],
        **kw,
    )


SEED = {
    "tmdbId": 157336,
    "title": "Interstellar",
    "year": "2014",
    "genres": ["Science Fiction", "Drama"],
    "original_language": "en",
}


# ── Intents ──────────────────────────────────────────────────────────────────

def test_intents_cover_the_specified_phrasings():
    """Different phrasings surface different threads — one query would give one
    community's answer."""
    qs = " ".join(intents.reddit_queries("Interstellar", "2014")).lower()
    assert "movies like" in qs
    assert "similar to" in qs
    assert "what to watch after" in qs
    assert "recommendations" in qs
    assert "if you liked" in qs


# ── Resolution ───────────────────────────────────────────────────────────────

def test_normalise_ignores_articles_and_punctuation():
    assert resolve.normalise("The Godfather, Part II") == "godfather part ii"
    assert resolve.normalise("Am??lie!") == resolve.normalise("Am??lie")


def test_year_beats_popularity_when_disambiguating():
    """A stated year is the strongest signal we have; popularity must not
    override it or every remake wins."""
    results = [
        {"id": 1, "title": "Parasite", "release_date": "2019-05-30", "popularity": 90},
        {"id": 2, "title": "Parasite", "release_date": "1982-01-01", "popularity": 2},
    ]
    assert resolve._pick(results, "Parasite", "1982")["id"] == 2
    assert resolve._pick(results, "Parasite", None)["id"] == 1


def test_exact_title_beats_a_more_popular_partial_match():
    results = [
        {"id": 1, "title": "Solaris Rising", "release_date": "2011-01-01", "popularity": 99},
        {"id": 2, "title": "Solaris", "release_date": "1972-01-01", "popularity": 20},
    ]
    assert resolve._pick(results, "Solaris", None)["id"] == 2


async def test_resolution_merges_spellings_of_the_same_film(monkeypatch):
    async def fake_search(title, page=1):
        return {"results": [{"id": 550, "title": "Fight Club",
                             "release_date": "1999-10-15", "popularity": 60}]}

    monkeypatch.setattr("app.integrations.tmdb.search_movies", fake_search)
    cands = await resolve.resolve([
        {"title": "Fight Club", **_mention()},
        {"title": "fight club", **_mention(name="letterboxd.com", source="web")},
    ])
    assert len(cands) == 1
    assert cands[0].mention_count == 2
    assert cands[0].distinct_sources == 2


async def test_unresolvable_titles_are_dropped(monkeypatch):
    """Never recommend a title TMDB doesn't know — a recommendation we can't
    link to a film page is worse than none."""
    async def nothing(title, page=1):
        return {"results": []}

    monkeypatch.setattr("app.integrations.tmdb.search_movies", nothing)
    assert await resolve.resolve([{"title": "Not A Real Film", **_mention()}]) == []


async def test_seed_film_is_excluded_from_its_own_pool(monkeypatch):
    async def fake_search(title, page=1):
        return {"results": [{"id": 157336, "title": "Interstellar",
                             "release_date": "2014-11-05", "popularity": 80}]}

    monkeypatch.setattr("app.integrations.tmdb.search_movies", fake_search)
    out = await resolve.resolve([{"title": "Interstellar", **_mention()}], exclude_tmdb_id=157336)
    assert out == []


# ── Scoring ──────────────────────────────────────────────────────────────────

def test_reddit_only_agreement_still_discriminates():
    """Discovery has to work without a Brave key.

    Reddit evidence carries the SUBREDDIT as its source name, so r/TrueFilm and
    r/horror agreeing counts as cross-source even with no web results. When
    every Reddit item was labelled a flat "reddit", this term collapsed to the
    same constant for every candidate and 25% of the scoring weight did nothing.
    """
    def sub(name):
        return _mention(source="reddit", name=f"r/{name}")

    one_loud = Candidate(tmdb_id=1, title="Loud", mentions=[sub("movies")] * 6)
    many_agree = Candidate(
        tmdb_id=2,
        title="Agreed",
        mentions=[sub("movies"), sub("TrueFilm"), sub("criterion"), sub("horror")],
    )

    loud = scoring._cross_source_agreement(one_loud)
    agreed = scoring._cross_source_agreement(many_agree)
    assert agreed > loud, "distinct subreddits must outrank one repeated subreddit"
    assert loud < 0.2, "a single subreddit is not agreement, however loud"


def test_cross_source_agreement_beats_repetition():
    """Three independent voices should outrank six posts in one subreddit —
    otherwise one loud thread decides what everyone sees."""
    echo = Candidate(tmdb_id=1, title="Echo", mentions=[_mention() for _ in range(6)])
    spread = Candidate(
        tmdb_id=2,
        title="Spread",
        mentions=[
            _mention(name="r/movies"),
            _mention(name="letterboxd.com", source="web", authority=0.9),
            _mention(name="rogerebert.com", source="web", authority=0.9),
        ],
    )
    assert scoring._cross_source_agreement(spread) > scoring._cross_source_agreement(echo)


def test_negative_sentiment_counts_against_a_film():
    """A film people warn you off is evidence *against*, not weak evidence for."""
    praised = Candidate(tmdb_id=1, title="Praised", mentions=[_mention(sentiment="positive")])
    warned = Candidate(tmdb_id=2, title="Warned", mentions=[_mention(sentiment="negative")])
    assert scoring._community_evidence(warned) < scoring._community_evidence(praised)
    assert scoring._community_evidence(warned) < 0


def test_single_mention_is_penalised_as_weak_evidence():
    lonely = _candidate(mentions=1)
    supported = Candidate(
        tmdb_id=2, title="Supported",
        mentions=[_mention(name="r/movies"), _mention(name="mubi.com", source="web")],
    )
    assert scoring._weak_evidence(lonely) == 1.0
    assert scoring._weak_evidence(supported) == 0.0


def test_every_score_records_its_features():
    """Weights can only be tuned later if the inputs were kept."""
    sc = scoring.score_candidate(_candidate(mentions=3), SEED)
    for key in (
        "community_evidence", "cross_source_agreement", "contextual_similarity",
        "user_taste_relevance", "novelty", "already_watched", "already_rated",
        "weak_evidence", "mention_count", "distinct_sources",
    ):
        assert key in sc.features


def test_weights_are_configurable():
    c = _candidate(mentions=4)
    off = scoring.score_candidate(c, SEED, weights=Weights(community_evidence=0.0))
    on = scoring.score_candidate(c, SEED, weights=Weights(community_evidence=1.0))
    assert on.score > off.score


# ── Lenses ───────────────────────────────────────────────────────────────────

def test_community_lens_ignores_the_viewer():
    """"What are people recommending" must not change because of who's asking."""
    pool = [_candidate(1, "One", 3), _candidate(2, "Two", 2)]
    plain = rank.rank(pool, SEED, lens="community")
    with_history = rank.rank(
        pool, SEED, lens="community", watched_tmdb_ids={1}, rated_tmdb_ids={1}
    )
    assert [s.candidate.tmdb_id for s in plain] == [s.candidate.tmdb_id for s in with_history]


def test_for_you_lens_demotes_films_already_seen():
    pool = [_candidate(1, "Seen", 5), _candidate(2, "Unseen", 4)]
    ranked = rank.rank(pool, SEED, lens="for_you", watched_tmdb_ids={1})
    assert ranked[0].candidate.tmdb_id == 2, "a film you've watched isn't a recommendation"


def test_both_lenses_share_one_pool():
    pool = [_candidate(i, f"F{i}", 2) for i in range(1, 6)]
    community = rank.rank(pool, SEED, lens="community")
    for_you = rank.rank(pool, SEED, lens="for_you", taste={"languages": ["en"]})
    assert {s.candidate.tmdb_id for s in community} == {s.candidate.tmdb_id for s in for_you}


# ── The constraint ───────────────────────────────────────────────────────────

async def test_evaluator_discards_films_outside_the_pool(monkeypatch):
    """Kaset's central promise, enforced in code rather than in the prompt.

    The model is told it may only pick from the pool. Here it disobeys and
    returns a film that was never a candidate — the evaluator must drop it.
    """
    pool = rank.rank([_candidate(i, f"Real {i}", 3) for i in (11, 12, 13)], SEED)

    async def rogue_llm(prompt, response_schema=None, system=None, model=None, temperature=0.2):
        return {
            "recommendations": [
                {"tmdb_id": 99999, "rank": 1, "confidence": 0.99,
                 "reason": "A film that was never in the pool."},
                {"tmdb_id": 11, "rank": 2, "confidence": 0.8, "reason": "Legitimate."},
            ]
        }

    monkeypatch.setattr("app.integrations.llm.is_available", lambda: True)
    monkeypatch.setattr("app.integrations.llm.generate_json", rogue_llm)

    out = await evaluator.evaluate(SEED, pool)
    ids = [r["tmdbId"] for r in out]
    assert 99999 not in ids, "a hallucinated film must never reach the user"
    assert 11 in ids


async def test_evaluator_falls_back_to_ranking_without_an_llm(monkeypatch):
    """No LLM key means less explanation, not a broken feature — the pool is
    already ordered by a transparent score."""
    monkeypatch.setattr("app.integrations.llm.is_available", lambda: False)
    pool = rank.rank([_candidate(i, f"F{i}", 3) for i in range(1, 9)], SEED)

    out = await evaluator.evaluate(SEED, pool)
    assert len(out) == evaluator.FINAL_COUNT
    assert [r["rank"] for r in out] == [1, 2, 3, 4, 5]


async def test_evaluator_returns_evidence_with_every_pick(monkeypatch):
    monkeypatch.setattr("app.integrations.llm.is_available", lambda: False)
    pool = rank.rank([_candidate(i, f"F{i}", 2) for i in range(1, 7)], SEED)

    for rec in await evaluator.evaluate(SEED, pool):
        assert rec["evidence"], "a recommendation with no evidence is just an assertion"
        assert "features" in rec and "score" in rec


async def test_evaluator_handles_an_empty_pool():
    assert await evaluator.evaluate(SEED, []) == []
