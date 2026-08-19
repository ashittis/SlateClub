# SlateClub Recommendation Engine — Full Technical Reference

> **Current state (verified against source).** The pipeline is a heuristic hybrid running on **fallback weights**: neither the XGBoost ranker nor the ALS collaborative model is trained anywhere in the codebase, so ranking is a fixed weighted sum and the ALS candidate source returns nothing at runtime. The semantic + content + graph + trending + per-language + director sources carry the feed today. The LLM layer is **OpenAI** (not Gemini). "Phase B" = wiring training over the `Impression` table.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [4-Stage Pipeline](#2-4-stage-pipeline)
3. [ML Models](#3-ml-models)
4. [LLM Integration (OpenAI)](#4-llm-integration-openai)
5. [Feature Engineering & Scoring](#5-feature-engineering--scoring)
6. [Graph-Powered Recommendations](#6-graph-powered-recommendations)
7. [Contextual Bandit (Reward Logging)](#7-contextual-bandit-reward-logging)
8. [Drift Detection & Taste Evolution](#8-drift-detection--taste-evolution)
9. [Cold-Start & Catalog Hydration](#9-cold-start--catalog-hydration)
10. [Supporting Services](#10-supporting-services)
11. [Data Models](#11-data-models)
12. [API Routes](#12-api-routes)
13. [End-to-End Request Flow](#13-end-to-end-request-flow)
14. [File Structure](#14-file-structure)

---

## 1. System Overview

SlateClub's recommendation engine is a multi-stage hybrid that combines:

- **Content-based filtering** — cosine of the user's 25-dim taste vector vs. movie embeddings
- **Semantic similarity** — cosine of the user's OpenAI taste embedding vs. each movie's OpenAI identity embedding
- **Graph-based discovery** — Neo4j taste graph (cluster consensus, friend boost, director affinity), Louvain "Cinematic Tribes"
- **Director affinity** — unwatched films by directors the user named in onboarding
- **Trending & per-language** — popularity and native-language coverage
- **Collaborative filtering (ALS)** — *wired but inert*: the model is never trained, so it returns no candidates at runtime
- **Learning-to-rank (XGBoost)** — *untrained*: a fixed 12-feature weighted sum stands in for the trained ranker
- **Contextualization** — time-of-day, session mood, explore/exploit, language interleave, surface tagging, explanations

The pipeline serves a final feed of **30 candidates per session, paginated 10/page**.

> **Honest status of the "learned" pieces.** ALS (`fit()` never called) and XGBoost (`train()` never called) are present as scaffolding. Today the ranker is a fixed weighted sum, and CF contributes only indirectly through the graph blend. The contextual bandit records rewards and persists them, but its weights are **not** consumed by the `/for-you` pipeline.

---

## 2. 4-Stage Pipeline

`backend/app/ml/pipeline/recommendation_pipeline.py`

```
Catalog (all cached movies)
     ↓
Stage 1: Candidate Generation  →  merged, deduped pool
     ↓
Stage 2: Pre-Filtering         →  minus watched + dismissed
     ↓
Stage 3: Scoring & Ranking     →  all candidates sorted (no truncation here)
     ↓
Stage 4: Contextualization     →  final feed (exactly 30, paginated 10/page)
```

> The `~10,000 → 500 → 300 → 30` figures in the module docstring are **illustrative, not enforced**. There is no 500-candidate cap in Stage 1 and no 300 cap in Stage 2; Stage 3 sorts and returns *all* candidates. Only Stage 4's `n_results=30` and the route's `page_size=10` are hard limits.

### Stage 1 — Candidate Generation

Pulls from multiple sources and merges into a deduplicated pool, tagging each candidate with its source (`content | als | semantic | trending | per_lang | director | graph`):

| Source | Count | Method | Runtime reality |
|---|---|---|---|
| Content-based | top 200 | Cosine: taste vector vs. 25-dim movie embedding | Active |
| Collaborative (ALS) | top 200 | ALS user × item factors | **Inert** — ALS never trained → returns `[]` |
| Semantic (OpenAI) | top 300 | Cosine: taste embedding vs. `identity_embedding` | Active once movies have identities + user has a taste embedding |
| Trending | top 50 | TMDB popularity | Active |
| Per-language top picks | 50/lang | Native-language coverage for the user's languages | Active |
| Director affinity | all matching | Catalog films by onboarding-named directors | Active (**undocumented in prior versions**) |
| Graph | up to 100 | Cluster consensus / friend boost / director affinity, prefetched by the route and injected via `priors["graph_candidates"]` | Active when Neo4j is populated |

Two-tower is deliberately **not** wired in (`tt_map = {}`). The graph score is blended into the ALS/CF feature slot as `max(als_score, graph_score × 0.8)` rather than being a standalone feature.

### Stage 2 — Pre-Filtering

`_stage2_prefilter` removes only:

1. **Already-watched** movies — from `WatchHistory` (the one-row-per-movie summary). Diary/`watch_log` is not read directly by the pipeline, but every diary write upserts `WatchHistory`, so viewings reach recs through that summary.
2. **Dismissed** movies — `MicroFeedback` rows with `type == "not_for_me"`.

**Language is *not* a hard filter here.** By design it is soft: applied as the `language_match` ranking feature (Stage 3) and the round-robin interleave (Stage 4), so a non-English user is boosted toward native content without emptying the pool.

### Stage 3 — Scoring & Ranking

Each candidate is scored via the XGBoost ranker over a **12-feature** matrix (see [Section 5](#5-feature-engineering--scoring)). The ranker is untrained, so `rank()` returns a fixed weighted sum of the features.

Post-ranking adjustments:
- **Director-affinity boost** — candidates from the director source get a Stage-3 score boost.
- **Diversity penalty** — if the same director appears 3+ times in the top 10, the 3rd+ occurrences are demoted (×0.5).

Candidates are then sorted descending (no top-30 truncation at this stage).

### Stage 4 — Contextualization

`_stage4_contextualize` shapes the sorted list into exactly 30 cards:

| Layer | Detail |
|---|---|
| Time-of-day boost | Late night (22:00–06:00 UTC): ×1.15 for runtime ≤ 100 min or Horror/Thriller. Morning (06:00–12:00 UTC): ×1.1 for Comedy/Family |
| Session mood boost | ×1.3 (+30%) for genres matching the session mood; `surprise` → shuffle |
| Explore / exploit split | 21 exploit (top-ranked) + 9 explore (lower pool) = 30 (`EXPLORE_RATIO = 0.3`) |
| Language interleaving | Round-robin balancing across the user's language priors |
| Surface assignment | `swipe_stack` (first 3), `for_you` (next, <12), `taste_cluster` (<20), `might_surprise_you` (rest) |
| Explanation generation | e.g. "Trending now", "{n}% match for your taste", "People with similar taste loved this", "Highly rated · {x}/10", "Picked for you" |

**Session Mood → Genre Map**

| Mood | Boosted Genres |
|---|---|
| `slow_contemplative` | Drama, History, Documentary |
| `fast_intense` | Action, Thriller, Crime |
| `funny_light` | Comedy, Family, Animation |
| `dark_unsettling` | Horror, Thriller, Mystery |
| `surprise` | No boost — shuffle for diversity |

---

## 3. ML Models

### 3.1 Taste Vector (25-dim)

`backend/app/ml/embeddings/taste_vector.py` — `VECTOR_DIM = 25`.

**Dimensions:**
- Dims 0–19: one-hot genre weights (20 TMDB genres)
- Dim 20: vote_average (normalized)
- Dim 21: popularity (normalized)
- Dim 22: runtime (normalized)
- Dim 23: decade signal
- Dim 24: non-English language flag (0/1)

**Signal weights per interaction:**

| Interaction | Weight |
|---|---|
| rating_5 | 1.00 |
| favorite | 0.90 |
| rating_4 | 0.85 |
| rating_3 | 0.60 |
| watched | 0.60 |
| watched_partial | 0.40 |
| rating_2 | 0.30 |
| watchlisted | 0.30 |
| rating_1 | 0.10 |
| skip | −0.30 |
| abandoned | −0.40 |
| not_interested | −0.50 |
| not_for_me | −0.60 |

**Computation:**

```
user_taste_vector = Σ(signal_weight × recency_decay × movie_embedding)
```

- Recency decay: λ = 0.003 (half-life ≈ 230 days)
- **Seed-prior blend is a dynamic ramp, not a fixed split.** The seed-prior anchor weight starts at **0.85** at cold start and ramps linearly down to **0.30** by the 20th interaction; revealed-preference weight = `1 − anchor`. (The "0.30 seed" is only the floor reached at ≥ 20 interactions.)
- Normalized via L2 norm.

### 3.2 Seed Prior Vector (from Onboarding)

Built from `OnboardingSignals` for low-interaction users:

1. Mean of film embeddings from poster picks + origin film (2× weight) + favorites
2. Mood sliders → genre/runtime bumps (`mood_realism`, `mood_tone`, `mood_pacing`)
3. Language hint (1.0 if non-English languages selected)

### 3.3 XGBoost Ranker

`backend/app/ml/models/xgboost_ranker.py` — **12 features** (not 11).

- **Objective**: binary:logistic · **max_depth**: 4 · **eta**: 0.1 · **eval_metric**: auc · **rounds**: 100
- **Training data (intended)**: watched + rated ≥ 4 + reviewed → positives; shown-but-not-clicked (`Impression`) → negatives
- **Status**: `.train()` exists but **is never called** anywhere. `self.trained` stays False and `rank()` always uses the fallback weighted sum below.

**Fallback weights (the ranker as it actually runs):**

| Index | Feature | Weight |
|---|---|---|
| 0 | taste_similarity | 0.17 |
| 1 | cf_score | 0.10 |
| 2 | content_score | 0.15 |
| 3 | two_tower_score | 0.00 (disabled) |
| 4 | trending_score | 0.05 |
| 5 | popularity | 0.05 |
| 6 | recency | 0.05 |
| 7 | genre_overlap | 0.05 |
| 8 | language_match | 0.10 |
| 9 | mood_alignment | 0.05 |
| 10 | semantic_similarity | 0.20 |
| 11 | completion_pct_avg | 0.03 |

(Weights sum to 1.0; `semantic_similarity` is the single largest.)

### 3.4 ALS Collaborative Filtering

`backend/app/ml/models/als.py` — factors 64, iterations 15, regularization 0.1, min 10 interactions.

- **Status**: `fit()` is **never called** in the app. `recommend()` therefore returns `[]`, so the ALS/CF candidate source is inert at runtime. CF influence reaches the feed only via the graph blend into the `cf_score` slot.

### 3.5 Content-Based Filtering

`backend/app/ml/models/content_based.py` — direct cosine between the user's taste vector and each movie's 25-dim embedding; returns top N. This is the workhorse candidate source.

### 3.6 Two-Tower Neural Model (stub)

`backend/app/ml/models/two_tower.py` — random projection (seed 123, ×0.1), `trained = False`, fallback weight 0.00, and **not wired** into candidate generation (`tt_map = {}`). Reserved for a future PyTorch replacement.

---

## 4. LLM Integration (OpenAI)

> **Provider correction:** the engine uses **OpenAI**, not Gemini. There is no `gemini_client.py` source (only a stale compiled artifact). Env var: `OPENAI_API_KEY`. Models (defaults in `core/config.py`): chat `OPENAI_LLM_MODEL = "gpt-5.5"`, embeddings `OPENAI_EMBED_MODEL = "text-embedding-3-large"` (3072-dim). `ANTHROPIC_API_KEY` exists in config but is unused by the ML layer.

### 4.1 OpenAI Client

`backend/app/ml/llm/openai_client.py` — `AsyncOpenAI` wrapper with:

| Method | Purpose |
|---|---|
| `generate_text()` | Plain-text generation |
| `generate_json()` | Structured/schema output |
| `embed()` | Text → float32 vector (`text-embedding-3-large`, 3072-dim) |

- Embeddings are stored as packed `np.float32` bytes.
- Graceful degradation: returns `None` when `OPENAI_API_KEY` is unset; the pipeline falls back to non-semantic paths.

### 4.2 Taste Describer

`backend/app/ml/llm/taste_describer.py` — from the user's top-rated films, reviews, genres, and directors, produces a taste statement, a 5-axis tone-tag classification (pace / tone / structure / perspective / emotional_register), and the input text for the taste embedding.

### 4.3 Movie Identity Extraction

`backend/app/ml/llm/movie_identity.py` — offline batch job (`scripts/extract_movie_identities.py`, **never on the request path**) that enriches each movie with a rich semantic identity. Beyond vibe/themes/audience/comparables, it produces a **9-axis affect rubric** (`tension, propulsion, control, valence, texture, scale, cognition, resolution, warmth`) plus an `affect_vector`, emotional arc, narrative DNA, and aftertaste. The concatenated summary is embedded and stored as `Movie.identity_embedding` (bytes) with `identity_json` and `identity_updated_at`.

### 4.4 Taste Identity Profile

`backend/app/ml/llm/taste_identity.py` — the user-facing taste fingerprint (primary axes, top-3 genre blend "X × Y × Z", director affinities, taste statement, tribe memberships).

---

## 5. Feature Engineering & Scoring

### 12-Feature Matrix (per candidate)

Order matches `xgboost_ranker.feature_names` and the pipeline's matrix build:

| Index | Name | Formula |
|---|---|---|
| 0 | `taste_similarity` | `cosine(user_taste_vector, movie_embedding)` |
| 1 | `cf_score` | `max(als_score, graph_score × 0.8)` (ALS ≈ 0 at runtime) |
| 2 | `content_score` | Content-based cosine score |
| 3 | `two_tower_score` | Two-tower score (≈ 0; disabled) |
| 4 | `trending_score` | 1.0 if in top-50 by popularity, else 0.0 |
| 5 | `popularity` | `clip(popularity / 500, 0, 1)` |
| 6 | `recency` | `clip((release_year − 2000) / 25, 0, 1)` |
| 7 | `genre_overlap` | `clip(|user_genres ∩ movie_genres| / 5, 0, 1)` |
| 8 | `language_match` | 1.0 if movie language ∈ user languages, else 0.3 |
| 9 | `mood_alignment` | `1 − min(|runtime − target_runtime| / 90, 1)`; `target_runtime = 130 − 30 × mood_pacing` |
| 10 | `semantic_similarity` | `cosine(user_taste_embedding, movie_identity_embedding)`; 0 if either missing |
| 11 | `completion_pct_avg` | Average watch-through signal (newer feature) |

---

## 6. Graph-Powered Recommendations

### 6.1 Taste Graph (Neo4j)

`backend/app/ml/graph/taste_graph.py` — **Nodes**: User, Movie, Director, Theme, Cluster.

| Edge | Direction | Weight |
|---|---|---|
| WATCHED | User → Movie | 0.6 |
| RATED | User → Movie | rating / 5 |
| REVIEWED | User → Movie | 1.0 + sentiment |
| TASTE_SIMILAR | User ↔ User | cosine similarity (written only when ≥ 0.7) |
| AFFINITY | User → Director | avg_rating / 5 |
| SIMILAR_TONE | Movie ↔ Movie | — |
| MEMBER_OF | User → Cluster | membership strength |

Graph writes are hydrated on watch/rating events via `services/watch_signals.py`.

### 6.2 Community Detection — Cinematic Tribes

`backend/app/ml/graph/community.py` — Louvain over the User–User TASTE_SIMILAR subgraph, `resolution = 1.0`, min cluster size 2 (needs ≥ 3 nodes to run). Tribe names are LLM-generated from dominant genres + languages, falling back to "Cinematic Tribe #N".

### 6.3 Graph-Based Candidate Sources

`backend/app/ml/graph/graph_recommend.py` — prefetched by the route (`get_graph_candidates(..., limit=100)`), injected into the pipeline via `priors["graph_candidates"]`:

| Source | Rule |
|---|---|
| Cluster consensus | Films rated ≥ 4 by ≥ 30% of the user's primary tribe |
| Friend boost | Films rated ≥ 4 by ≥ 2 taste-similar users |
| Director affinity | Unwatched films by directors where user affinity ≥ 0.7 |

---

## 7. Contextual Bandit (Reward Logging)

`backend/app/ml/llm/contextual_bandit.py` — an epsilon-greedy bandit over **5 source arms**: `content, cf, graph, trending, serendipity`.

> **Scope note.** The bandit **records and persists rewards** but its blend weights are **not consumed by the `/for-you` pipeline**. Rewards are logged from `services/watch_signals.py` (on watch and rating, keyed to a recent `Impression.source`), and the learned weights are exposed only via `GET /api/taste/bandit/weights`.

### Segments & Base Weights

| Segment | Rule | content | cf | graph | trending | serendipity |
|---|---|---|---|---|---|---|
| `heavy_rater` | > 50 ratings | 35% | 25% | 20% | 10% | 10% |
| `new_user` | < 7 days OR < 5 ratings | 15% | 10% | 10% | 35% | 30% |
| `social_user` | > 10 follows | 15% | 15% | 40% | 15% | 15% |
| `discovery_seeker` | *(defined but unreachable — `classify_user` never returns it)* | 10% | 10% | 20% | 10% | 50% |
| `default` | Fallback | 25% | 25% | 20% | 15% | 15% |

### Learning Rule & Persistence

- **Epsilon**: 0.1 (10% explore / 90% exploit)
- **Reward**: `0.4 × clicked + 0.4 × watch_through_rate + 0.2 × (rating / 5)`
- **Weight update**: `final = 0.5 × base_weights + 0.5 × learned_rewards`
- **Persistence**: writes to `backend/app/ml/llm/bandit_state.json` on every `record_reward`, reloaded on init. Shape: `{ segment: { source: { "pulls": int, "total_reward": float } } }`.

---

## 8. Drift Detection & Taste Evolution

`backend/app/ml/llm/drift_detector.py`

```
drift_score = 1 − cosine_similarity(recent_30d_vector, lifetime_vector)
```

Requires ≥ 5 interactions across both a recent and an older bucket.

| Threshold | State | Action |
|---|---|---|
| drift_score > 0.35 | Phase Transition | Trigger adaptations below |
| drift_score < 0.15 | Stable | No action *(computed instantaneously; the doc's "90 days" is not tracked in code)* |

**Adaptations on phase transition:** `accelerated_decay`, `exploration_boost` (30/70 → 50/50), `recalibration_prompt`, `cluster_reevaluation`, `taste_identity_update`.

> Not wired into the live feed path — no caller of `get_drift_adaptations` inside `/for-you`.

---

## 9. Cold-Start & Catalog Hydration

`backend/app/routes/recommendations.py` — `hydrate_catalog_for_languages()`

**Problem**: a new user with e.g. Tamil/Korean preferences may have 0 matching local movies.

**Solution**: on each `/for-you` call, for the user's non-English languages with sparse coverage:

1. Query TMDB Discover (≈ 3 pages per missing language)
2. Target ~60 films/language
3. Upsert to the `Movie` table (savepoint per upsert)
4. Cache the hydrated language set for ~1 hour (in-process); en/hi baseline

---

## 10. Supporting Services

Real, load-bearing pieces that surround the pipeline:

| Service | Role |
|---|---|
| `services/taste_cache.py` | Redis-cached per-user 25-dim taste vector (15-min TTL) with explicit invalidation on rating/watch/watchlist writes |
| `services/taste_embedding.py` | Generates/stores the user's OpenAI taste statement + embedding into `UserTasteState`; triggered after the 5th rating and on drift. Populates the embedding that gates Stage-1 semantic candidates |
| `services/watch_signals.py` | Central hook firing graph hydration + contextual-bandit reward + pairwise taste similarity + taste-vector/embedding invalidation on watch and rating events |
| `services/impressions.py` + `Impression` model | Logs every surfaced rec (surface, position, rank_score, source, session) — the future XGBoost training set; `log_impressions` runs in `/for-you` |
| `services/diary_service.py` | Keeps the new per-viewing `watch_log` diary in sync with the `WatchHistory` summary that recs read |

---

## 11. Data Models

### Movie

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| tmdb_id | int | Indexed; unique with media_type |
| media_type | str | `movie` \| `tv` |
| title, overview, release_date | str/date | — |
| runtime, original_language | int/str | — |
| poster_path, backdrop_path | str | TMDB paths |
| vote_average, vote_count, popularity | float | — |
| genres, credits | JSON | `[{id,name}]` / `{crew, cast}` |
| identity_json | JSON | OpenAI-extracted MovieIdentity (9-axis affect + affect_vector) |
| identity_embedding | bytes | float32 packed embedding |
| identity_updated_at | datetime | — |

### User / UserPreferences / UserTasteState

- **User** — id, email, username, name, bio, avatar_url, google_id, onboarded, plus IP-geo (`city`, `region`, `country`, `geoUpdatedAt`).
- **UserPreferences** — `profile_visibility` (`public` \| `followers` \| `private`), language selections, etc.
- **UserTasteState** — `taste_statement`, `taste_embedding` (OpenAI), `tone_axes` JSON, `last_drift_score`, `last_computed_at`.

### OnboardingSignals

`user_id`, `poster_picks[int]`, `mood_pacing`/`mood_tone`/`mood_realism` ∈ [−1,1], `platforms[str]`, `origin_film_tmdb_id`, `prefers_theatres`.

### Interaction Tables (`actions.py`)

| Table | Key Fields |
|---|---|
| Rating | user_id, movie_id, value (0.25–5.0) — one per (user, movie) |
| WatchlistItem | user_id, movie_id, shelf-note reason/reference/note |
| WatchHistory | user_id, movie_id, completion_pct, watched_at — **one-row summary per (user, movie)** |
| **DiaryEntry** (`watch_log`) | user_id, movie_id, watched_at, rating, is_rewatch, at_theatre, visibility (`public`\|`private`), review_id — **one row per viewing** (see diary/wrapped feature) |
| CurrentlyWatching | user_id, movie_id, progress_pct, started_at |
| DnfEntry | user_id, movie_id, reason, stopped_at, progress_pct |
| Review | user_id, movie_id, season_number, body, spoiler |
| SeasonRating / EpisodeRating / EpisodeReaction | series/episode-level granularity |

> **Recs read `WatchHistory`, not `watch_log`.** Diary viewings reach the pipeline only because every diary write upserts the `WatchHistory` summary.

### Social Tables (`social.py`)

| Table | Key Fields |
|---|---|
| Follow | follower_id, following_id |
| ActivityEvent | user_id, type, movie_id, event_metadata *(feeds are derived live from source tables; ActivityEvent rows are not the primary feed source)* |
| MicroFeedback | user_id, movie_id, type (`not_for_me` \| `skip` \| `not_interested` \| …) |
| Impression | user_id, movie_id, surface, position, rank_score, **source**, session_id, shown_at |

---

## 12. API Routes

**Recommendations** — under `/api/recommendations/`:

### `GET /for-you`
- **Query**: `session_mood` ∈ `{slow_contemplative, fast_intense, funny_light, dark_unsettling, surprise, skip}`; `page` (1-indexed, 10/page)
- **Auth**: JWT
- **Response**: `results[]` with `id, tmdb_id, title, poster_path, explanation, surface, match_score`, plus `page, total, session_mood, pipeline`

### `GET /session-moods`
Returns the 5 UI mood options (`slow_contemplative, fast_intense, funny_light, dark_unsettling, surprise`). Note `skip` is accepted by `/for-you` but not listed here.

### `GET /debug`
Diagnostic dump: onboarding signals, computed priors (seed-prior norm, taste-embedding presence), interaction counts, catalog composition per language, diagnostic messages.

**Related** — `GET /api/taste/bandit/weights` (`routes/taste.py`) exposes the bandit's learned per-segment blend weights.

---

## 13. End-to-End Request Flow

```
GET /api/recommendations/for-you?session_mood=slow_contemplative&page=1
         │
         ▼
[Auth]  Verify JWT → resolve user_id
         │
         ▼
Load Interactions   (Ratings, Watchlist, Favorites, MicroFeedback)
         │
         ▼
Load User Priors
  • OnboardingSignals → seed_prior_vector (25-dim), seed-anchor ramp
  • Language selections; mood_pacing/tone/realism
  • UserTasteState.taste_embedding (OpenAI); taste vector via taste_cache (Redis)
  • Graph candidates prefetched (limit 100) → priors["graph_candidates"]
         │
         ▼
Catalog Hydration (if sparse languages) → TMDB Discover → upsert (1-hr cache)
         │
         ▼
Fetch all Movies; compute watched_ids (WatchHistory) + dismissed_ids (MicroFeedback not_for_me)
         │
         ▼
STAGE 1 — Candidate Generation
  content 200 · als 200(→∅ untrained) · semantic 300 · trending 50
  per-language 50/lang · director-affinity · graph(≤100)  → merge + dedup (source-tagged)
         │
         ▼
STAGE 2 — Pre-Filter   (remove watched + dismissed; language stays soft)
         │
         ▼
STAGE 3 — Scoring & Ranking
  12-feature matrix → xgboost_ranker.rank() (fallback weighted sum)
  director-affinity boost · diversity penalty (same-director ×0.5) · sort desc
         │
         ▼
STAGE 4 — Contextualization
  time-of-day · session-mood ×1.3 · 21 exploit + 9 explore · language interleave
  surface assignment · explanation strings  → exactly 30
         │
         ▼
Log Impressions (surface/position/rank_score/source/session)
         │
         ▼
Paginate → results[0:10] for page=1  →  strip internal fields  →  200 OK
```

---

## 14. File Structure

```
backend/app/ml/
├── embeddings/
│   └── taste_vector.py              25-dim taste vector + seed-prior ramp + blending
├── models/
│   ├── als.py                       ALS CF (64 factors) — never trained → inert at runtime
│   ├── content_based.py             Cosine content filtering (primary source)
│   ├── two_tower.py                 Random-projection stub (disabled, weight 0)
│   └── xgboost_ranker.py            Stage-3 ranker, 12 features, fallback weights (untrained)
├── llm/
│   ├── openai_client.py             OpenAI wrapper (text, JSON, embed) — gpt-5.5 / text-embedding-3-large
│   ├── movie_identity.py            Offline: 9-axis affect MovieIdentity + embedding per film
│   ├── taste_describer.py           Taste statement + tone tags
│   ├── taste_identity.py            User-facing taste fingerprint
│   ├── contextual_bandit.py         Epsilon-greedy reward logger → bandit_state.json
│   ├── bandit_state.json            Persisted per-segment reward stats
│   └── drift_detector.py            Taste phase-transition detection (not in feed path)
├── graph/
│   ├── taste_graph.py               Neo4j nodes/edges/queries
│   ├── community.py                 Louvain clustering → Cinematic Tribes
│   └── graph_recommend.py           Graph candidate sources
└── pipeline/
    └── recommendation_pipeline.py   4-stage orchestrator

backend/app/services/
├── taste_cache.py                   Redis taste-vector cache (15-min TTL) + invalidation
├── taste_embedding.py               Builds/stores UserTasteState taste embedding (OpenAI)
├── watch_signals.py                 Graph + bandit + similarity hooks on watch/rating
├── impressions.py                   Impression logging (future training data)
└── diary_service.py                 watch_log ↔ WatchHistory sync

backend/app/routes/
├── recommendations.py               /for-you, /session-moods, /debug + catalog hydration
└── taste.py                         /api/taste/bandit/weights (+ taste surfaces)

backend/app/models/
├── movie.py                         Movie (+ identity_json / identity_embedding)
├── user.py                          User (+ geo) / UserPreferences / UserTasteState
├── onboarding.py                    OnboardingSignals + FavoritePerson + FavoriteMovie
├── actions.py                       Rating, WatchlistItem, WatchHistory, DiaryEntry(watch_log),
│                                    CurrentlyWatching, DnfEntry, Review, Season/Episode ratings
└── social.py                        Follow, ActivityEvent, MicroFeedback, Impression

scripts/
└── extract_movie_identities.py      Batch offline job: OpenAI MovieIdentity extraction
```
