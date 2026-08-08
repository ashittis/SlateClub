# discovery — browse, search, and the home feed

Everything a user hits while *looking* for something to watch: the home feed, the
free-form search box, and the "movies like X" discovery rows. It reads the user's taste
signals and turns them into browsable rows and results.

## Files
- **`feed.py`** — the home feed. Blends recommendation output, social activity, and
  session mood into scoped tabs (For You / Browse). Logs impressions so the ranker learns
  what was actually shown.
- **`discover.py`** — the discovery rows page: trending, "because you liked…", and
  onboarding-seeded rows. Uses the `trending` service and the user's onboarding signals.
- **`search.py`** — unified search across films (TMDB + local), people, and slates.
  Uses taste vectors to bias film results toward the user's taste, cached via `taste_cache`.
- **`consensus.py`** — the **Community Intelligence Engine** route: `POST /api/discovery/consensus`.
  Given a seed film, returns the film community's web-sourced consensus on "what to watch
  next" (grounded in real mention frequency), re-ranked through the user's Cinema DNA, each
  with a human "why". Authed. Reads only the cached pool; warms off-response on a miss and
  serves the essence engine's answer meanwhile.
- **`community_engine.py`** — the engine itself (offline/warm path): gather corpus (Reddit +
  Brave web search) → LLM title-extraction per source → resolve to TMDB → weighted-frequency
  consensus scoring → LLM "why" reasoning → cache in `discovery_cache`. Also grounds the
  essence engine with the same corpus.
- **`community_scoring.py`** — pure, unit-testable consensus scoring: source authority
  weights, cross-source-agreement bonus, `matchScore` %, and the provenance label.
- **`community_personalize.py`** — request-time re-rank of the shared community pool by the
  user's 25-dim taste vector + the "most people say X, but for you Y" callout.
- **`community_warm.py`** — off-response warming (fire-and-forget from the request path,
  single-flighted per seed; and an awaitable `warm_seed` for the CLI warmer). Opens its own
  session — never the request's. Batch CLI: `scripts/warm_discovery.py`.

## How it works
1. `feed.py` asks `features/recommendation` for ranked candidates, mixes in `ActivityEvent`
   items from people the user follows, and applies the current `SessionMoodBar` filter.
2. Each shown card is recorded through `shared/services/impressions` (feeds the ML ranker).
3. `search.py` runs a live TMDB query, upserts hits into the local `Movie` table, and
   re-orders by cosine similarity to the user's taste vector.

## Talks to
- shared models: `movie`, `actions`, `social`, `onboarding`, `slates`
- shared services: `trending`, `impressions`, `geo`, `taste_cache`
- ml: `embeddings.taste_vector`; features/recommendation for ranked candidates
- external: TMDB
