# discovery — evidence-first recommendations

    SEED → INTENTS → EVIDENCE → EXTRACT → RESOLVE → POOL → SCORE → RANK → EVALUATE

Kaset never asks a model what to watch. It asks *people* — on Reddit, in film
writing — and then uses a model to read what they said (KASET.md §9).

## Files
| File | Stage |
|---|---|
| `intents.py` | how we phrase the question, five ways |
| `evidence/collect.py` | Reddit (primary) + Brave (secondary) → `EvidenceItem`s |
| `evidence/schema.py` | what evidence and a candidate are |
| `extract.py` | LLM reads passages → structured title mentions |
| `resolve.py` | TMDB resolution; **unresolved titles are dropped** |
| `weights.py` | the scoring dials, env-overridable |
| `scoring.py` | pure scoring; records every feature |
| `rank.py` | the community / for-you lenses |
| `evaluate.py` | LLM picks the final five, constrained to the pool |
| `pipeline.py` | orchestration + evidence persistence |
| `routes.py` | `GET /api/discovery/similar/{tmdb_id}?lens=` |
| `search.py` | film and people search (a separate concern) |

## The rules

**The LLM never names a film.** In extraction it only reads passages people
wrote; in evaluation it only ranks a resolved pool. It is never asked "what is
like X?".

**The constraint is enforced in code.** `evaluate.py` filters its own output
against the pool's tmdb_id set and discards anything outside it. The promise
that Kaset never surfaces a hallucinated film does not depend on the model
obeying an instruction — see `test_evaluator_discards_films_outside_the_pool`.

**Unresolved titles are dropped.** A recommendation we can't link to a real film
page is worse than no recommendation.

**One pool, two lenses.** Separate candidate generation per lens would let FOR
YOU drift into a personalisation engine and stop being evidence-first.

**The request path is cache-only.** Collection runs in `scripts/warm_discovery.py`.
A page never waits on Reddit and never fails because a key is missing.

## Degradation

Everything is availability-gated and degrades independently:

| Missing | Effect |
|---|---|
| Reddit key | web-only evidence |
| Brave key | Reddit-only evidence |
| LLM key | **no new pools can be built** (extraction needs it); existing pools still rank and serve, with the sources' own quotes shown instead of a generated reason |
| Nothing warmed | `warm: false` and an honest empty, not a fabricated list |

## Scoring

Weights live in `weights.py`, overridable via `KASET_DISCOVERY_W_*`. They are
**not** final — every score persists the features that produced it
(`discovery_evidence`, and `features` on each result) precisely so they can be
evaluated against real outcomes rather than tuned by intuition.
