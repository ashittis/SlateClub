# SlateClub Recommendation Engine — Full Technical Reference

> **Current Phase**: MVP Phase 3 (XGBoost fallback weights active; full training pending Phase B)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [4-Stage Pipeline](#2-4-stage-pipeline)
3. [ML Models](#3-ml-models)
4. [LLM Integration (Gemini)](#4-llm-integration-gemini)
5. [Feature Engineering & Scoring](#5-feature-engineering--scoring)
6. [Graph-Powered Recommendations](#6-graph-powered-recommendations)
7. [Contextual Bandit (Source Blending)](#7-contextual-bandit-source-blending)
8. [Drift Detection & Taste Evolution](#8-drift-detection--taste-evolution)
9. [Cold-Start & Catalog Hydration](#9-cold-start--catalog-hydration)
10. [Data Models](#10-data-models)
11. [API Routes](#11-api-routes)
12. [End-to-End Request Flow](#12-end-to-end-request-flow)
13. [File Structure](#13-file-structure)

---

## 1. System Overview

SlateClub's recommendation engine is a multi-stage hybrid system that combines:

- **Content-based filtering** (taste vectors vs. movie embeddings)
- **Collaborative filtering** (ALS on implicit interactions)
- **Semantic similarity** (Gemini LLM embeddings of user taste + movie identity)
- **Graph-based discovery** (Neo4j taste graph, Louvain tribe clustering)
- **Learning-to-rank** (XGBoost ranker over 11 engineered features)
- **Contextual bandits** (epsilon-greedy source blending per user segment)
- **Contextualization** (time-of-day, session mood, explore/exploit)

The pipeline reduces ~10,000 catalog movies to a final ranked feed of 30 per session, paginated at 10.

---

## 2. 4-Stage Pipeline

```
Catalog (~10,000)
     ↓
Stage 1: Candidate Generation  →  ~500 candidates
     ↓
Stage 2: Pre-Filtering         →  ~300 candidates
     ↓
Stage 3: Scoring & Ranking     →  top 30
     ↓
Stage 4: Contextualization     →  final feed (30, paginated 10/page)
```

### Stage 1 — Candidate Generation

Pulls from five sources and merges into a deduplicated pool:

| Source | Count | Method |
|---|---|---|
| Content-based | 200 | Cosine sim: user taste vector vs. movie embeddings |
| Collaborative filtering | 200 | ALS user factors × item factors |
| Semantic (Gemini) | 300 | Cosine sim: user taste embedding vs. movie identity embedding |
| Trending | 50 | Top 50 movies by TMDB popularity score |
| Per-language top picks | 50/lang | Ensures multi-language users get native content |

**Total after dedup**: ~500 unique candidates

### Stage 2 — Pre-Filtering

Removes ineligible candidates from the pool:

1. Already-watched movies (from WatchHistory)
2. Dismissed / "not for me" / skipped movies (from MicroFeedback)
3. Language filter — applied only when user selected non-English languages; if filter removes all candidates it is automatically relaxed

**Result**: ~300 candidates

### Stage 3 — Scoring & Ranking

Each of the ~300 candidates is scored via XGBoost using an 11-feature matrix (see [Section 5](#5-feature-engineering--scoring)).

Post-ranking diversity penalty: if the same director appears 3+ times in the top 10, the 3rd+ occurrences are demoted.

**Result**: Top 30 candidates sorted by predicted engagement probability

### Stage 4 — Contextualization

Final shaping of the ranked list before serving:

| Layer | Detail |
|---|---|
| Time-of-day boost | Late night (22:00–06:00): +15% for short films, horror, thriller. Morning (06:00–12:00): +10% for comedy, family |
| Session mood boost | +30% score for genres matching current session mood (see mood map below) |
| Explore / exploit split | 70% top-ranked (exploit) + 30% from lower pool (explore) |
| Language interleaving | Round-robin to balance languages per user priors |
| Surface assignment | Each card tagged: `swipe_stack`, `for_you`, `taste_cluster`, `might_surprise_you` |
| Explanation generation | Human-readable reason string: "92% match for your taste", "Trending now", etc. |

**Session Mood → Genre Map**

| Mood | Boosted Genres |
|---|---|
| `slow_contemplative` | Drama, History, Documentary |
| `fast_intense` | Action, Thriller, Crime |
| `funny_light` | Comedy, Family, Animation |
| `dark_unsettling` | Horror, Thriller, Mystery |
| `surprise` | No boost — maximize diversity via shuffle |

---

## 3. ML Models

### 3.1 Taste Vector (25-dim)

`backend/app/ml/embeddings/taste_vector.py`

A 25-dimensional float vector representing the user's cinematic taste.

**Dimensions:**
- Dims 0–19: One-hot genre weights (20 TMDB genres: Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Musical, Mystery, Romance, Sci-Fi, TV Movie, Thriller, War, Western, Mystery)
- Dim 20: vote_average (normalized / 10)
- Dim 21: popularity (normalized / 500)
- Dim 22: runtime (normalized / 240 min)
- Dim 23: decade signal (1950–2025 range)
- Dim 24: non-English language flag (0 or 1)

**Signal weights applied per interaction:**

| Interaction | Weight |
|---|---|
| rating_5 | 1.00 |
| rating_4 | 0.85 |
| favorite | 0.90 |
| rating_3 | 0.60 |
| watched | 0.60 |
| not_for_me | -0.60 |
| not_interested | -0.50 |
| rating_2 | 0.30 |
| watchlisted | 0.30 |
| rating_1 | 0.10 |
| skip | -0.30 |

**Computation:**

```
user_taste_vector = Σ(signal_weight × recency_decay × movie_embedding)
```

- Recency decay: λ = 0.003 (half-life ≈ 230 days)
- Seed prior blending: `blended = 0.7 × revealed + 0.3 × seed_prior`
- Normalized via L2 norm

### 3.2 Seed Prior Vector (from Onboarding)

Built from `OnboardingSignals` when a user has few interactions:

1. Mean of film embeddings from: poster picks + origin film (2× weight) + favorites
2. Mood axes translated to genre/runtime signals:
   - `mood_realism` → boosts Sci-Fi/Fantasy/Animation (positive) or Drama/Documentary/History (negative)
   - `mood_tone` → boosts Comedy/Family/Animation (positive) or Horror/Thriller/Crime (negative)
   - `mood_pacing` → runtime dimension signal
3. Language signal: 1.0 if non-English languages selected

### 3.3 XGBoost Ranker

`backend/app/ml/models/xgboost_ranker.py`

Learning-to-rank model predicting engagement probability (0–1) per candidate.

- **Objective**: binary:logistic
- **Max depth**: 4
- **Rounds**: 100
- **Training data**: watched + rated ≥4 + reviewed → positives; shown-but-not-clicked (Impression table) → negatives
- **Status**: Phase 3 uses fallback weights (untrained). Full XGBoost training pending Phase B.

**Fallback weights (when untrained):**

| Feature | Weight |
|---|---|
| taste_similarity | 0.20 |
| semantic_similarity | 0.20 |
| content_score | 0.15 |
| cf_score | 0.10 |
| language_match | 0.10 |
| trending | 0.05 |
| popularity | 0.05 |
| recency | 0.05 |
| genre_overlap | 0.05 |
| mood_alignment | 0.05 |
| two_tower_score | 0.00 (injecting noise; disabled) |

### 3.4 ALS Collaborative Filtering

`backend/app/ml/models/als.py`

Implicit feedback matrix factorization.

- **Latent factors**: 64
- **Iterations**: 15
- **Regularization**: 0.1
- **Minimum interactions required**: 10 (falls back to cold-start content signals if under)
- **Inference**: `scores = item_factors @ user_factors[u_idx]`
- Also supports `similar_items()` for item-item similarity queries

### 3.5 Content-Based Filtering

`backend/app/ml/models/content_based.py`

Direct cosine similarity between the user's taste vector and each movie's 25-dim embedding. Returns top N candidates ranked by score.

### 3.6 Two-Tower Neural Model (Phase 3 stub)

`backend/app/ml/models/two_tower.py`

- **User tower**: taste_vector (25-dim) → random projection → 64-dim user embedding
- **Movie tower**: movie_embedding (25-dim) → random projection → 64-dim movie embedding
- **Similarity**: dot product in shared 64-dim space
- **Status**: Currently uses random projection matrices (seed=123); weight=0.1 (effectively disabled). Phase 5 will replace with PyTorch trained on positive/negative interaction pairs + in-batch softmax loss.

---

## 4. LLM Integration (Gemini)

### 4.1 Gemini Client

`backend/app/ml/llm/gemini_client.py`

Thin wrapper around the Google Generative AI SDK with three surfaces:

| Method | Purpose | Temperature | Max Tokens |
|---|---|---|---|
| `generate_text()` | Plain-text generation | 0.5 | 400 |
| `generate_json()` | Structured output with schema | 0.4 | — |
| `embed()` | Text → float32 vector | — | — |

- Embedding model: configured via `Settings.GEMINI_EMBED_MODEL` (typically `embedding-001`)
- Embeddings stored as packed `np.float32` bytes in the database
- Graceful degradation: returns `None` when `GEMINI_API_KEY` is unset; pipeline falls back to non-semantic paths

### 4.2 Taste Describer

`backend/app/ml/llm/taste_describer.py`

Takes user's top-rated movies, reviews, favorite genres, and favorite directors as input and produces:

1. **Taste statement** — 2–3 LLM-generated sentences describing the user's cinematic taste
2. **Tone tags** — 5-axis classification:
   - `pace`: slow-burn | measured | kinetic
   - `tone`: dark | warm | cold | dreamlike | absurd
   - `structure`: linear | nonlinear | episodic | circular
   - `perspective`: unreliable-narrator | omniscient | intimate
   - `emotional_register`: cathartic | unsettling | contemplative | exhilarating
3. **Taste embedding** — Gemini embedding of the taste statement (RETRIEVAL_QUERY task type), stored in `UserTasteState.taste_embedding`

### 4.3 Movie Identity Extraction

`backend/app/ml/llm/movie_identity.py`

Offline batch process that enriches each movie with semantic identity. Input: TMDB metadata (plot, cast, genres, director, runtime). Output JSON schema:

```json
{
  "vibe": "1-line overall feel",
  "themes": ["3–5 semantic noun phrases"],
  "audience": "1-line target viewer description",
  "comparable_films": ["3–5 actual film titles"],
  "tone_axes": {
    "pace": 0.0,
    "realism": 0.0,
    "emotional_register": "text"
  },
  "audience_warnings": "slow first act",
  "summary_paragraph": "2–3 sentences packed with semantic signal"
}
```

The embedding is computed from: `summary + vibe + themes + audience + comparable_films` concatenated, then stored as `Movie.identity_embedding` (bytes). **Never computed on the request path** — runs via `scripts/extract_movie_identities.py`.

### 4.4 Taste Identity Profile

`backend/app/ml/llm/taste_identity.py`

Generates the user-facing taste fingerprint shown on their profile:

- Primary axes (pace, tone strength)
- Genre blend: top 3 genres formatted as "X × Y × Z"
- Director affinities: `[{name, affinity (0–1)}]`
- Taste statement (LLM-generated)
- Tribe memberships (Cinematic Tribes)

---

## 5. Feature Engineering & Scoring

### 11-Feature Matrix (per candidate)

| Index | Name | Formula |
|---|---|---|
| 0 | `taste_similarity` | `cosine_sim(user_taste_vector, movie_embedding)` |
| 1 | `cf_score` | ALS recommendation score |
| 2 | `content_score` | Content-based cosine similarity score |
| 3 | `tt_score` | Two-tower neural score (≈0 currently) |
| 4 | `trending` | 1.0 if in top-50 by popularity, else 0.0 |
| 5 | `popularity` | `clip(movie.popularity / 500, 0, 1)` |
| 6 | `recency` | `clip((release_year - 2000) / 25, 0, 1)` |
| 7 | `genre_overlap` | `clip(len(user_genres ∩ movie_genres) / 5, 0, 1)` |
| 8 | `language_match` | 1.0 if movie language in user_languages, else 0.3 |
| 9 | `mood_alignment` | `1.0 - min(abs(runtime - target_runtime) / 90, 1)` where `target_runtime = 130 - 30 × mood_pacing` |
| 10 | `semantic_similarity` | `cosine_sim(user_taste_embedding, movie_identity_embedding)`; 0 if either missing |

**Mood pacing → target runtime:**
- `mood_pacing = -1` → target 160 min (long, slow)
- `mood_pacing = +1` → target 100 min (short, kinetic)

---

## 6. Graph-Powered Recommendations

### 6.1 Taste Graph (Neo4j)

`backend/app/ml/graph/taste_graph.py`

**Node types**: User, Movie, Director, Theme, Cluster

**Edge types:**

| Edge | Direction | Weight |
|---|---|---|
| WATCHED | User → Movie | 0.6 |
| RATED | User → Movie | rating / 5 |
| REVIEWED | User → Movie | 1.0 + sentiment |
| TASTE_SIMILAR | User ↔ User | cosine similarity (threshold ≥ 0.7) |
| AFFINITY | User → Director | avg_rating / 5 |
| SIMILAR_TONE | Movie ↔ Movie | — |
| MEMBER_OF | User → Cluster | membership strength |

### 6.2 Community Detection — Cinematic Tribes

`backend/app/ml/graph/community.py`

- **Input**: User–User TASTE_SIMILAR subgraph
- **Algorithm**: Louvain clustering, resolution = 1.0
- **Minimum cluster size**: 2 members
- **Tribe naming**: LLM generates names from dominant genres + languages. Fallback: "Cinematic Tribe #N"

### 6.3 Graph-Based Candidate Sources

`backend/app/ml/graph/graph_recommend.py`

| Source | Rule |
|---|---|
| Cluster consensus | Movies rated ≥4 by ≥30% of user's primary tribe |
| Friend boost | Movies rated ≥4 by ≥2 taste-similar users |
| Director affinity | Unwatched films by directors where user affinity ≥ 0.7 |

---

## 7. Contextual Bandit (Source Blending)

`backend/app/ml/llm/contextual_bandit.py`

An epsilon-greedy bandit that adjusts how many candidates come from each source based on user segment.

### User Segments & Base Weights

| Segment | Rule | Content | CF | Graph | Trending | Serendipity |
|---|---|---|---|---|---|---|
| `heavy_rater` | >50 ratings | 35% | 25% | 20% | 10% | 10% |
| `new_user` | <7 days OR <5 ratings | 15% | 10% | 10% | 35% | 30% |
| `social_user` | >10 follows | 15% | 15% | 40% | 15% | 15% |
| `discovery_seeker` | — | 10% | 10% | 20% | 10% | 50% |
| `default` | Fallback | 25% | 25% | 20% | 15% | 15% |

### Learning Rule

- **Epsilon**: 0.1 (10% explore, 90% exploit)
- **Reward**: `0.4 × CTR + 0.4 × watch_through_rate + 0.2 × (rating / 5)`
- **Weight update**: `final = 0.5 × base_weights + 0.5 × learned_rewards`

---

## 8. Drift Detection & Taste Evolution

`backend/app/ml/llm/drift_detector.py`

Detects when a user's taste is meaningfully shifting so the engine can adapt.

**Metric:**

```
drift_score = 1 - cosine_similarity(recent_30d_vector, lifetime_vector)
```

| Threshold | State | Action |
|---|---|---|
| drift_score > 0.35 | Phase Transition | Trigger adaptations below |
| drift_score < 0.15 for 90+ days | Stable | No action |

**Adaptations on phase transition:**

1. Accelerated decay: interactions >60 days old weighted at 0.5×
2. Exploration boost: explore/exploit ratio shifts from 30/70 → 50/50
3. Recalibration prompt shown to user: "Your taste seems to be evolving"
4. Off-cycle Louvain re-clustering for the user's neighborhood
5. Force immediate recompute of UserTasteState

---

## 9. Cold-Start & Catalog Hydration

`backend/app/routes/recommendations.py` — `hydrate_catalog_for_languages()`

**Problem**: A new user with Tamil or Korean language preferences may have 0 matching movies in the local DB.

**Solution**: On each `/for-you` call, if a user's preferred non-English languages have sparse catalog coverage:

1. Query TMDB Discover API for 3 pages per missing language
2. Target: 60 films per language minimum
3. Upsert results to the Movie table (savepoint per upsert — one failure doesn't kill the call)
4. Cache the hydrated language set for 1 hour to avoid repeated TMDB API hits

---

## 10. Data Models

### Movie

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| tmdb_id | int | Unique, indexed |
| title, overview, release_date | string/date | — |
| runtime, original_language | int/str | — |
| poster_path, backdrop_path | string | TMDB paths |
| vote_average, vote_count, popularity | float | — |
| genres | JSON | `[{id, name}, ...]` |
| credits | JSON | `{director: {name}, cast: [{name}]}` |
| identity_json | JSON | Gemini-extracted MovieIdentity |
| identity_embedding | bytes | float32 packed embedding |
| identity_updated_at | datetime | — |

### User

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| email, username | string | Unique, indexed |
| name, bio, avatar_url | string | — |
| google_id | string | Optional, OAuth |
| onboarded | boolean | — |

### OnboardingSignals

| Field | Type | Notes |
|---|---|---|
| user_id | string FK | Unique per user |
| poster_picks | list[int] | TMDB ids from gut-test |
| mood_pacing, mood_tone, mood_realism | float | [-1, 1] range |
| platforms | list[str] | Streaming services |
| origin_film_tmdb_id | int | Anchor film |

### UserTasteState

| Field | Type | Notes |
|---|---|---|
| user_id | string FK | Primary key |
| taste_statement | string | LLM-generated |
| taste_embedding | bytes | Gemini embedding of taste statement |
| tone_axes | JSON | {pace, tone, structure, perspective, emotional_register} |
| last_drift_score | float | From drift detector |
| last_computed_at | datetime | — |

### Interaction Tables

| Table | Key Fields |
|---|---|
| Rating | user_id, movie_id, value (0–5) |
| WatchlistItem | user_id, movie_id |
| WatchHistory | user_id, movie_id, completion_pct (0–1), watched_at |
| Review | user_id, movie_id, body (text), spoiler (bool) |
| MicroFeedback | user_id, movie_id, type (not_for_me \| skip \| not_interested) |
| Impression | user_id, movie_id, surface, position, rank_score, session_id, shown_at |

> Impression is critical for Phase B XGBoost training: it provides "shown but not clicked" negatives.

### Social Tables

| Table | Key Fields |
|---|---|
| Follow | follower_id, following_id |
| ActivityEvent | user_id, type (rated \| reviewed \| watched \| watchlisted \| followed), movie_id |

---

## 11. API Routes

All routes under `/api/recommendations/`.

### `GET /for-you`

**Query params:**
- `session_mood`: `slow_contemplative | fast_intense | funny_light | dark_unsettling | surprise | skip`
- `page`: int (1-indexed, 10 results per page)

**Auth**: JWT required

**Response:**

```json
{
  "results": [
    {
      "id": "uuid",
      "tmdb_id": 123,
      "title": "...",
      "poster_path": "...",
      "explanation": "92% match for your taste",
      "surface": "for_you",
      "match_score": 92
    }
  ],
  "page": 1,
  "total": 30,
  "session_mood": "slow_contemplative",
  "pipeline": "ml-v1"
}
```

### `GET /session-moods`

Returns the list of available mood options for the UI dropdown.

### `GET /debug`

**Auth**: User only — diagnostic dump of recommendation state.

**Includes:**
- Onboarding signals (languages, favorites, moods)
- Computed priors (seed_prior norm, taste_embedding presence)
- Interaction counts
- Catalog composition (movies per language)
- Diagnostic messages

---

## 12. End-to-End Request Flow

```
GET /api/recommendations/for-you?session_mood=slow_contemplative&page=1
         │
         ▼
[Auth]  Verify JWT → resolve user_id
         │
         ▼
Load Interactions
  • Ratings (rating_1 to rating_5 signal types)
  • Watchlist
  • Favorites
  • MicroFeedback (not_for_me, skip, not_interested)
         │
         ▼
Load User Priors
  • OnboardingSignals → seed_prior_vector (25-dim)
  • Language selections
  • mood_pacing, mood_tone, mood_realism → persistent_mood
  • UserTasteState.taste_embedding (Gemini)
         │
         ▼
Catalog Hydration (if needed)
  • For each non-English language with sparse coverage
  • TMDB Discover → upsert to Movie table (1-hr cache)
         │
         ▼
Fetch all Movies from DB
         │
         ▼
Get watched_ids + dismissed_ids
         │
         ▼
STAGE 1 — Candidate Generation
  content_based.recommend(taste_vec)      → 200
  als.recommend(user_id)                  → 200
  _semantic_candidates(taste_embedding)   → 300
  trending top 50                         →  50
  per_language top picks                  → 50/lang
  ────────────────────────────────────────────────
  Merge + dedup                           → ~500
         │
         ▼
STAGE 2 — Pre-Filter
  Remove watched_ids
  Remove dismissed_ids
  Language filter (relaxed if it empties the pool)
  ────────────────────────────────────────────────
  → ~300 candidates
         │
         ▼
STAGE 3 — Scoring & Ranking
  Build 11-feature matrix per candidate
  xgboost_ranker.rank(features) → [0,1] score
  Sort descending
  Diversity penalty (same-director demotion)
  ────────────────────────────────────────────────
  → Top 30 candidates
         │
         ▼
STAGE 4 — Contextualization
  Time-of-day boost
  Session mood genre boost (+30%)
  Explore/exploit split (70% top / 30% lower)
  Language round-robin interleaving
  Surface assignment
  Explanation string generation
  ────────────────────────────────────────────────
  → 30 ranked + contextualized candidates
         │
         ▼
Log Impressions → Impression table
         │
         ▼
Paginate → results[0:10] for page=1
         │
         ▼
Strip internal fields (_rank_score, _surface, etc.)
         │
         ▼
200 OK — Response JSON
```

---

## 13. File Structure

```
backend/app/ml/
├── embeddings/
│   └── taste_vector.py              25-dim taste embedding + seed prior + blending
├── models/
│   ├── als.py                       ALS collaborative filtering (64 factors, 15 iters)
│   ├── content_based.py             Cosine-similarity content filtering
│   ├── two_tower.py                 Phase 3 stub → Phase 5 PyTorch upgrade
│   └── xgboost_ranker.py            Stage 3 ranker (11 features, fallback weights active)
├── llm/
│   ├── gemini_client.py             Gemini API wrapper (text, JSON, embed)
│   ├── movie_identity.py            Offline: extract + embed MovieIdentity per film
│   ├── taste_describer.py           Taste statement + tone tags + taste embedding
│   ├── taste_identity.py            User-facing taste fingerprint
│   ├── contextual_bandit.py         Epsilon-greedy source blending per user segment
│   └── drift_detector.py            Taste phase transition detection
├── graph/
│   ├── taste_graph.py               Neo4j graph operations (nodes, edges, queries)
│   ├── community.py                 Louvain clustering → Cinematic Tribes
│   └── graph_recommend.py           Graph-based candidate generation
└── pipeline/
    └── recommendation_pipeline.py   4-stage orchestrator

backend/app/routes/
└── recommendations.py               /for-you, /session-moods, /debug endpoints

backend/app/models/
├── movie.py                         Movie SQLAlchemy model
├── user.py                          User + UserPreferences + UserTasteState
├── onboarding.py                    OnboardingSignals + FavoritePerson + FavoriteMovie
├── actions.py                       Rating, WatchlistItem, WatchHistory, Review, Comment
└── social.py                        Follow, ActivityEvent, MicroFeedback, Impression

scripts/
└── extract_movie_identities.py      Batch offline job: Gemini identity extraction for all movies
```
