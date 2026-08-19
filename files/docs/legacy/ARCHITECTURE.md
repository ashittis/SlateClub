# SlateClub — System Architecture

> "Spotify × Letterboxd for movies" — a unified platform for discovering, tracking, reviewing, and discussing films, powered by a proprietary taste graph and mood-aware recommendation engine.

---

## Table of Contents

1. [Recommendation Engine](#1-recommendation-engine)
   - 1.1 Signal Collection Layer
   - 1.2 Feature Engineering
   - 1.3 Recommendation Models (Hybrid 4-Layer)
   - 1.4 Taste Graph Engine
   - 1.5 Recommendation Pipeline
   - 1.6 Feedback Loop & Continuous Learning
   - 1.7 Interactive Taste Onboarding (Spotify-Style)
   - 1.8 Taste Calibration Loop
2. [Movie Page Design](#2-movie-page-design)
3. [System Design](#3-system-design)
4. [Tech Stack, Data & APIs](#4-tech-stack-data--apis)
5. [Scalability & Differentiation](#5-scalability--differentiation)

---

## 1. Recommendation Engine

The recommendation engine is the core moat of SlateClub. It is not a genre filter. It is a living model of your cinematic identity — what you love, how you watch, when you watch, and who you watch like.

---

### 1.1 Signal Collection Layer

Every user interaction is a signal. Signals are classified into three tiers:

#### Explicit Signals (high confidence, low volume)
| Signal | How Collected | Weight |
|---|---|---|
| Star rating (0.5–5) | Direct tap on rating widget | Very High |
| Written review | Full text submission | Very High |
| Mood tag on film | Optional tag at review time | High |
| "Watched" mark | Button tap | High |
| Watchlist add | Button tap | Medium-High |
| "Not interested" | Explicit dismiss button | Negative (strong) |

#### Implicit Signals (lower confidence, high volume)
| Signal | How Collected | Weight |
|---|---|---|
| Card dwell time | Time spent on swipe card before action | Medium |
| Swipe direction | Accept (right) vs. reject (left) | Medium |
| Trailer play % | How much of trailer was watched | Medium |
| Scroll depth on film page | How far user read | Low-Medium |
| Click-through source | Which recommendation surface drove the click | Medium |
| Search query text | What the user searched for | Medium |
| Filter selections | Mood/genre/platform filters chosen | Medium |
| Session time-of-day | When the session occurred | Contextual |

#### Negative Signals
- Fast-swipe dismissal (< 0.5s dwell) → strong negative
- Skipping multiple films from the same director → director affinity drop
- Removing film from watchlist without watching → mild negative

#### Micro-Feedback Signals (contextual, medium-high confidence)

Micro-feedback captures in-session reactions that are more specific than a dismiss but lighter than a review. These signals are surfaced via contextual buttons on recommendation cards and post-watch prompts.

| Signal | How Collected | Weight | Effect |
|---|---|---|---|
| "Not in the mood" | Tap on recommendation card | Medium-High | Suppresses similar tone/mood for current session only; does **not** penalize film long-term |
| "Too slow" / "Too intense" | Post-watch prompt or card action | High | Adjusts pace/tone dimensions of user taste vector by −0.15 on relevant axis |
| "Seen similar" | Tap on recommendation card | Medium | Triggers diversity boost: demote films with cosine similarity > 0.85 to recently shown films |
| "Not for me" | Explicit dismiss with reason | High (negative) | Stronger than swipe-reject; updates exclusion model for genre/theme/director |
| "More like this" | Tap on recommendation card | High (positive) | Immediate same-session boost: retrieve 5 nearest neighbors and inject into feed |

#### Signal Storage Schema
```
event_log (append-only)
├── user_id          UUID
├── item_id          UUID (movie)
├── signal_type      ENUM (watch, rate, review, swipe_accept, swipe_reject,
│                          micro_not_mood, micro_too_slow, micro_too_intense,
│                          micro_seen_similar, micro_not_for_me, micro_more_like_this, ...)
├── signal_value     FLOAT (rating 0–5, dwell seconds, trailer pct, etc.)
├── context_json     JSONB { time_of_day, session_id, source_surface, mood_override }
└── created_at       TIMESTAMPTZ

```

**Processing cadence:**
- Streamed into feature store **hourly** (implicit signals aggregated)
- Batch-processed into user-item interaction matrix **nightly**
- Explicit signals (ratings, reviews) processed **immediately** via event bus

---

### 1.2 Feature Engineering

#### User Taste Vector

A user is not their genre preferences. A user is a weighted superposition of everything they've ever loved.

> **As-built (Phase 3–4):** The production taste vector computed by `backend/app/ml/embeddings/taste_vector.py` is a simplified **25-dim** vector — 20 genre one-hot dimensions + 5 metadata dimensions — with onboarding-anchor blending (anchor weight decays 0.85 → 0.30 over the first ~20 interactions). The 512-dim composite described below is the **Phase 5 target** (full visual/semantic/entity embeddings), not yet wired.

The Phase 5 design treats the vector as a 512-dim composite:

```
user_taste_vector = Σ (signal_weight × recency_decay × drift_factor × movie_embedding)
                    for all interacted movies

where:
  signal_weight  = f(signal_type)  →  review=1.0, rating=0.85, watched=0.6, saved=0.3
  recency_decay  = exp(-λ × days_since_interaction)  →  λ tuned so 6-month-old = 0.33×
  drift_factor   = phase_weight(interaction)  →  1.0 if in current taste phase, 0.5 if prior phase
```

**Taste Drift Detection:**

The system tracks whether a user's recent interactions diverge significantly from their established taste vector. When drift is detected, the system enters a "new phase" mode where older preferences decay faster and recent signals receive amplified weight.

```
drift_score = 1 - cosine_similarity(taste_vector_last_30d, taste_vector_lifetime)

if drift_score > 0.35:
  → Mark user as "taste phase transition"
  → Increase λ (decay rate) by 2× for interactions older than 60 days
  → Weight last-30-day interactions at 1.5× normal
  → Log phase transition for downstream analysis

if drift_score < 0.15 for 90 consecutive days:
  → Revert to standard λ decay
  → User is in "stable taste" mode
```

**Sub-vector decomposition:**
- `taste_vector_weekday` — computed from weekday sessions
- `taste_vector_weekend` — computed from weekend sessions
- These are used separately at serving time (context-aware ranking)

**Explicit mood tags as multipliers:**
When a user tags a film "cerebral" or "intense," that tag boosts the corresponding mood dimensions of that film's embedding in the user's vector — amplifying the directional signal.

#### Movie Attribute Vector

> **As-built (Phase 3–4):** Movies carry a stored `identity_json` + `identity_embedding` (migration `0016_movie_identity`), produced by `backend/app/ml/llm/movie_identity.py`. The LLM scores each film on a **9-axis affect rubric** (see table below) and that profile is embedded via OpenAI `text-embedding-3-large`. The 512-dim four-source composite below is the **Phase 5 target**.

The Phase 5 design assembles a 512-dim composite from four sources:

```
movie_vector = concat([
  base_features,        // 64-dim: genre one-hot, era, language, runtime bucket, certificate
  visual_embedding,     // 128-dim: CLIP embedding from poster + trailer thumbnail
  semantic_embedding,   // 192-dim: sentence-transformer over plot synopsis + top-10 reviews
  entity_embedding      // 128-dim: learned director/cast co-occurrence embeddings
])
```

**Movie identity — 9-axis affect rubric (as-built, OpenAI-extracted):**
Each film is scored by the LLM (`app/ml/llm/movie_identity.py`) on nine continuous affect axes. This profile is what is actually embedded and stored per film:

| Axis | Captures |
|---|---|
| Tension | calm ↔ anxious / suspenseful |
| Propulsion | slow-burn ↔ kinetic / driving |
| Control | chaotic ↔ precise / composed |
| Valence | bleak ↔ hopeful |
| Texture | clean ↔ gritty / tactile |
| Scale | intimate ↔ epic |
| Cognition | visceral ↔ cerebral |
| Resolution | ambiguous ↔ resolved |
| Warmth | cold ↔ tender |

**Conceptual tone dimensions (UI taxonomy):**
The film page surfaces these as human-readable chips, derived from the affect axes above:

| Dimension | Values |
|---|---|
| Pace | slow-burn / measured / kinetic |
| Tone | dark / warm / cold / dreamlike / absurd |
| Structure | linear / nonlinear / episodic / circular |
| Perspective | unreliable narrator / omniscient / intimate |
| Emotional register | cathartic / unsettling / contemplative / exhilarating |

The affect profile feeds directly into the movie vector and is surfaced as UI chips on film pages.

#### Context Features (serving-time)

| Feature | Description |
|---|---|
| `time_of_day_bucket` | morning / afternoon / evening / late-night |
| `day_of_week` | weekday vs. weekend |
| `trending_score_7d` | Bayesian-smoothed view count velocity (last 7 days) |
| `trending_score_30d` | Same, 30-day window |
| `social_boost` | Count of taste-cluster friends who rated ≥ 4 in last 14 days |
| `mood_override` | User-specified mood (from UI) — overrides contextual inference |

---

### 1.3 Recommendation Models (Hybrid 4-Layer)

The system runs four complementary models. Their outputs are merged into a unified candidate pool before ranking.

> **As-built status** (`backend/app/ml/models/`):
> - **Layer 1 — ALS** (`als.py`): built; gracefully skipped until ~10 interactions exist, then trains on the implicit-feedback matrix.
> - **Layer 2 — Content-based** (`content_based.py`): built; genre/metadata cosine, active from day zero.
> - **Layer 3 — Two-tower** (`two_tower.py`): **stub** — a random-projection placeholder stands in for the jointly-trained network. Full PyTorch training is a **Phase 5** item.
> - **Layer 4 — LLM semantic** (`app/ml/llm/`): built via **OpenAI** (`gpt-5.5` for descriptions, `text-embedding-3-large` for the query vector).

#### Layer 1 — Collaborative Filtering (ALS)

**What it does:** Finds patterns across all users without using any film metadata. If users who loved Mulholland Drive and Cache also loved a film you haven't seen — you'll see it.

- Algorithm: Alternating Least Squares on implicit feedback matrix
- Output: 200-dim user factor + item factor per film
- Strength: captures emergent taste patterns invisible to metadata
- Weakness: blind to new films; cold-start users have no factor

#### Layer 2 — Content-Based Filtering

**What it does:** Computes cosine similarity between your taste vector and each film's attribute vector. Handles new films immediately.

```
score(user, movie) = cosine_similarity(user_taste_vector, movie_attribute_vector)
```

- Handles new movies on day zero (metadata available before any ratings)
- Also serves new users who went through onboarding taste selection

#### Layer 3 — Two-Tower Neural Retrieval

**What it does:** A jointly-trained neural network encodes both users and films into a shared 128-dim embedding space. Optimized directly on watch/skip outcomes.

```
Architecture:
  User Tower:  [interaction_history_embeddings] → MLP → 128-dim user_embedding
  Movie Tower: [movie_attribute_vector] → MLP → 128-dim movie_embedding

Training signal: 
  Positive pairs: (user, movie) where user watched + rated ≥ 4
  Negative pairs: (user, movie) where user dismissed or rated ≤ 2
  Loss: in-batch softmax (similar to SimCLR)
```

At serving time: ANN (Approximate Nearest Neighbor) search over pre-indexed movie embeddings. Returns top-300 candidates in < 20ms.

#### Layer 4 — LLM Semantic Taste Alignment *(Differentiator)*

**What it does:** Uses a language model (OpenAI `gpt-5.5`, via `app/ml/llm/taste_describer.py` → `taste_identity.py`) to generate a natural-language description of the user's taste, then embeds that description as a semantic query vector.

```
Input:  [last 20 reviews written by user] + [explicit mood/tone tags]

Prompt: "Based on these film reviews, describe this person's cinematic taste in 
         2-3 sentences. Focus on tone, storytelling style, pacing, and themes."

Output: "Gravitates toward morally complex slow-burn thrillers where environment 
         shapes character. Values ambiguity over resolution. Prefers naturalistic 
         cinematography and non-linear structure."

→ Embed this via OpenAI text-embedding-3-large → semantic query vector
→ ANN search over movie semantic embedding index
```

This enables matching that genre tags cannot: "feels like early Park Chan-wook" or "same stillness as Tati" — without ever mentioning those directors explicitly.

Runs **nightly** (async), updates stored taste description vector per user.

**Layer Interaction:**

```
Layers 1, 2, 3 run in parallel → each produces scored candidate list
Layer 4 produces a semantic candidate list (async, used from nightly cache)

All lists → merge → deduplicate → unified candidate pool (~500 films)
                                          ↓
                                    Ranking Layer
```

#### Phased Activation

Not all layers run from day one. The system activates layers as data density allows:

| Phase | Active Layers | Why |
|---|---|---|
| Phase 2 (Social Core) | Layer 2 only (content-based) | Sufficient from TMDB metadata alone; no interaction data needed |
| Phase 3 (Rec Engine V1) | Layers 1 + 2 (ALS + content) | ALS requires ~10K user-item interactions to be useful; content-based covers cold-start gap |
| Phase 4 (Taste Graph) | Layers 1 + 2 + graph signals | Graph signals supplement CF; two-tower not yet justified |
| Phase 5 (Advanced) | All 4 layers | Two-tower needs ~100K interaction pairs; LLM layer needs review corpus depth |

The contextual bandit (Section 1.6) automatically adjusts blend weights as new layers come online, so no manual tuning is required at phase transitions.

---

### 1.4 Taste Graph Engine

The taste graph is SlateClub's core moat. It is a living knowledge graph connecting users, films, directors, themes, and moods — with edge weights derived from real behavioral signals.

> **As-built (Phase 4):** Wired on **Neo4j** via `backend/app/ml/graph/` — `taste_graph.py` (schema + node/edge ops over the `neo4j_client`), `community.py` (**python-louvain** community detection → "Cinematic Tribes"), and `graph_recommend.py` (cluster-consensus + friend-boost queries).

#### Graph Schema

```
NODES
├── User        { user_id, taste_vector, cluster_memberships[] }
├── Movie       { movie_id, attribute_vector, tone_tags[], language }
├── Director    { director_id, style_embedding }
├── Actor       { actor_id }
├── Theme       { theme_id, label }  e.g. "unreliable narrator", "urban alienation"
└── Mood        { mood_id, label }  e.g. "cerebral", "melancholic"

EDGES
├── User → Movie      : WATCHED (weight: signal_strength)
├── User → Movie      : RATED (weight: normalized_rating)
├── User → Movie      : REVIEWED (weight: 1.0 + sentiment_score)
├── User → Movie      : SAVED (weight: 0.3)
├── User → User       : TASTE_SIMILAR (weight: cosine_sim of taste_vectors, ≥ 0.7 threshold)
├── User → Director   : AFFINITY (weight: avg_rating_for_director_films)
├── User → Theme      : PREFERENCE (weight: frequency × explicit_tag_boost)
├── Movie → Movie     : SIMILAR_TONE (weight: cosine_sim of attribute_vectors)
└── Movie → Movie     : SHARES_DIRECTOR (weight: 1.0)
```

#### Taste Clustering (Cinematic Tribes)

```
Algorithm: Louvain community detection on User-User TASTE_SIMILAR graph

Output examples:
  Cluster #1: "Korean Noir Devotees"      — 4,200 users
  Cluster #2: "Slow Cinema Collective"    — 1,800 users  
  Cluster #3: "90s Arthouse Circuit"      — 3,100 users
  Cluster #4: "Tamil New Wave"            — 2,600 users
  Cluster #5: "Midnight Horror Heads"     — 5,400 users
```

- Clusters have **soft membership** — a user can belong to multiple with varying weights
- Membership score shown in UI as user's "Cinematic Tribe" — drives social identity + retention
- Recalculated weekly

#### Taste Identity Profile

Beyond cluster membership, each user has a computed **Taste Identity** — a human-readable, multi-dimensional fingerprint of their cinematic preferences. This drives retention by giving users a sense of self-knowledge ("SlateClub understands me").

```
taste_identity = {
  primary_axes: [
    { dimension: "pace",        position: "slow-burn",          strength: 0.82 },
    { dimension: "tone",        position: "dark & atmospheric", strength: 0.76 },
    { dimension: "structure",   position: "non-linear",         strength: 0.61 },
    { dimension: "perspective", position: "intimate",           strength: 0.58 }
  ],
  
  genre_blend: "Psychological Thriller × Slow Cinema × Neo-Noir",
  
  director_affinities: [
    { name: "Park Chan-wook", affinity: 0.91 },
    { name: "Denis Villeneuve", affinity: 0.84 },
    { name: "Bong Joon-ho", affinity: 0.79 }
  ],
  
  taste_statement: "You gravitate toward morally complex slow-burns where
                    atmosphere drives tension. You value ambiguity over
                    resolution and prefer intimate, unreliable perspectives.",
  
  tribes: ["Korean Noir Devotees (primary)", "Slow Cinema Collective"]
}
```

**Computation:**
- `primary_axes`: derived from the user's taste vector projected onto the tone tag dimensions (Section 1.2)
- `genre_blend`: top-3 genre clusters by weighted interaction count, formatted as a compound label
- `director_affinities`: from `User → Director : AFFINITY` edges in the taste graph
- `taste_statement`: generated by LLM Layer (Section 1.3, Layer 4) — the same nightly taste description, reformatted for the user

**Update cadence:** Recomputed **nightly** alongside taste vector updates. Changes surfaced to the user only when a dimension shifts by > 0.1 (avoids noisy fluctuation).

#### Graph-Powered Recommendations

| Signal Type | Mechanism |
|---|---|
| Cluster consensus | Films rated ≥ 4 by ≥ 30% of your primary cluster → boosted |
| Second-degree bridge | Films popular in a cluster adjacent to yours → discovery |
| Friend boost | Films rated ≥ 4 by ≥ 2 followed friends → strong boost |
| Director affinity path | New film by director you've rated highly across ≥ 3 films → surfaced |
| Theme thread | Films sharing themes from your top-reviewed films → surfaced |

#### Graph Update Cadence

- Edge weight updates: **streaming** (as events arrive via event bus)
- User-User similarity edges: **nightly** (recomputed from updated taste vectors)
- Community detection: **weekly** (full Louvain re-run)
- Exported embeddings: **nightly** (for fast lookup by recommendation service)

---

### 1.5 Recommendation Pipeline

A Netflix-style multi-stage funnel that turns 10,000+ candidates into a personalized feed of 30 films.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STAGE 1 — CANDIDATE GENERATION         (~10,000 → 500)
├── Two-tower ANN retrieval             top 300
├── ALS collaborative filtering         top 200
├── Graph neighborhood retrieval        top 100
├── Trending picks (7-day velocity)     top  50
├── Editorial / curated lists           top  20
└── Merge + deduplicate                →  ~500 candidates

STAGE 2 — PRE-FILTERING                (~500 → 300)
├── Remove: already watched
├── Remove: "not interested" dismissed
├── Remove: below platform pref threshold (if strong pref detected)
├── Remove: language excluded by user
└── Filtered pool                      →  ~300 candidates

STAGE 3 — SCORING & RANKING            (~300 → 30)
├── Feature assembly per candidate:
│     [user_embedding, movie_embedding,
│      context_features, social_features,
│      trend_score, taste_match_score]
├── XGBoost ranking model
│     (trained on: did user watch? did they rate ≥ 4? did they review?)
├── Diversity penalty (same director ×3 in top 10 → demote 3rd)
├── Freshness boost (not shown in last 30 days → +0.05 score)
├── Explore/exploit split (70/30):
│     70% of slots → exploit (highest predicted relevance)
│     30% of slots → explore (promising candidates with high uncertainty)
│     Uncertainty = inverse of user interaction count with similar films
└── Top 30 scored candidates           →   30 ranked films

STAGE 4 — CONTEXTUALIZATION            (30 → final feed)
├── Time-of-day adjustment:
│     late-night → boost films ≤ 100min + horror/thriller
│     morning    → boost feel-good + shorter runtime
├── Session mood prompt:
│     On feed open → "What are you in the mood for?" (optional, skippable)
│     Options: [Slow & contemplative] [Fast & intense] [Funny & light]
│              [Dark & unsettling] [Surprise me] [Skip]
│     If selected → rerank top 30 by mood vector alignment
│     "Surprise me" → maximize diversity score across top 30
│     If skipped → use time-of-day inference (default behavior)
│     Session mood expires after 2 hours or app close
├── Explanation generation per film:
│     "Because you loved Burning"
│     "Trending in your Korean Noir Tribe"
│     "Your taste twin watched this last week"
│     "92% match · slow-burn psychological thriller"
├── Surface format assignment:
│     slot 1-3   → swipe stack (home screen)
│     slot 4-12  → "For You" shelf
│     slot 13-20 → taste cluster shelf
│     slot 21-30 → "Might Surprise You" (serendipity)
└── Final feed returned to client      →  30 items + explanations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Latency target:** Full pipeline < 200ms at serving time (Stage 1–3 pre-computed, Stage 4 at request time).

---

### 1.6 Feedback Loop & Continuous Learning

The system improves with every action. There is no static model.

#### Online (Real-Time, < 1 min lag)

| Action | Immediate Effect |
|---|---|
| Swipe accept | Adds film to positive candidate pool for next session |
| Swipe reject | Adds film/director/genre to soft-exclusion for next 72h |
| Watch > 80% completion | Strong positive signal, weight = 1.0 |
| Watch < 20% completion | Mild negative signal (abandoned) |
| Review submitted | Triggers NLP pipeline, updates taste vector within 5 min |

#### Offline (Batch Retraining)

| Cadence | Job |
|---|---|
| Nightly | Recompute user taste vectors from full signal log |
| Nightly | Rebuild movie attribute vectors for newly released/rated films |
| Weekly | Retrain two-tower neural model on last 90 days of interaction data |
| Weekly | Re-run Louvain community detection on updated taste graph |
| Monthly | Full ALS matrix factorization retrain on complete interaction matrix |
| Monthly | Retrain XGBoost ranking model on fresh outcome labels |

#### Reinforcement Signal (Contextual Bandit)

Each recommendation source (CF, content, graph, trending) is treated as a bandit arm.

```
For each user segment:
  Reward signal = 0.4 × CTR  +  0.4 × watch_through_rate  +  0.2 × post_watch_rating

Contextual bandit adjusts source blend weights per user segment:
  Heavy raters     → upweight content-based (values precision)
  New users        → upweight trending + editorial (less personalization data)
  Social users     → upweight graph signals (friend activity matters to them)
  Discovery-seekers → upweight serendipity slot + second-degree graph bridges
```

#### Taste Drift Adaptation

When the system detects a taste phase transition (see Section 1.2, drift_score > 0.35):

| Adaptation | Mechanism |
|---|---|
| Accelerated decay | Older preferences (> 60 days) weighted at 0.5× for 30 days |
| Exploration boost | Explore/exploit ratio shifts temporarily to 50/50 (from 70/30) |
| Recalibration prompt | User shown: "Your taste seems to be evolving. Want to update your preferences?" → links to onboarding people/movies steps |
| Cluster re-evaluation | Triggers off-cycle Louvain re-run for this user's neighborhood |
| Taste Identity update | Forces immediate recompute of taste identity (Section 1.4) instead of waiting for nightly batch |

Phase transitions are logged as first-class events in the event bus (`taste.phase_transition`) for analytics and model training.

---

### 1.7 Interactive Taste Onboarding (Spotify-Style)

The onboarding flow mirrors Spotify's progressive profiling approach: each step narrows and personalizes the next. Designed to extract a high-fidelity taste profile in under 2 minutes.

> **As-built:** The implemented flow is an **8-step "Tune Your Taste"** sequence (not the original 3-step design). Pages live under `frontend/src/app/onboarding/` and step state is held in `frontend/src/stores/onboardingStore.ts`, which exposes one submit action per step (`markWelcomed`, `submitLanguages`, `submitPosters`, `submitMood`, `submitPlatforms`, `submitPeople`, `submitOrigin`, `submitMovies`) posting to the `onboarding` router (`backend/app/routes/onboarding.py`). The progress bar counts 8 numbered steps; `welcome` and `ready` are unnumbered bookends.

#### Step 1 — Welcome (`/onboarding/welcome`)

Intro screen — sets the tone, no input collected. Calls `markWelcomed()`.

#### Step 2 — Language Selection (`/onboarding/languages`)

```
"What languages do you watch movies in?"

  [Hindi ✓]     [English ✓]    [Punjabi]
  [Tamil ✓]     [Telugu]       [Malayalam]
  [Marathi]     [Gujarati]     [Bengali]
  [Kannada]     [Korean]       [Japanese]
  [French]      [Spanish]

  Select all that apply. (Color-coded chips)
```

- 14 language options covering Indian cinema + international
- Maps to TMDB `with_original_language` filter for discovery
- Strongest first signal — language preference predicts 60%+ of what a user will watch
- Stored as `LanguageSelection` records (ISO 639-1 codes)

#### Step 3 — Poster Calibration (`/onboarding/posters`)

A rapid visual taste-calibration pass — the user reacts to a grid of posters. Quick, low-effort signal that seeds the initial taste direction before any explicit favourites are picked. Stored as poster picks on `OnboardingSignals`.

#### Step 4 — Mood Sliders (`/onboarding/mood`)

Three continuous sliders (each clamped to [−1, 1]) capture preferred register:

```
  Pacing    slow & contemplative  ●───────  fast & kinetic
  Tone      light & warm          ───●────  dark & heavy
  Realism   grounded              ──────●─  stylised / surreal
```

- Component: `components/onboarding/MoodSlider.tsx`
- Establishes the user's default position on the pace/tone axes used at ranking time

#### Step 5 — Platforms & Theatre Preference (`/onboarding/platforms`)

Which streaming services the user has, plus a theatre-going preference. Drives the pre-filter (Section 1.5, Stage 2) and "where to watch" surfacing.

#### Step 6 — Actor & Director Affinity Picks (`/onboarding/people`)

```
"Who do you love watching?"

  Search: [________________]

  Popular:
  [Shah Rukh Khan ✓]  [Rajinikanth]  [Alia Bhatt ✓]
  [Park Chan-wook]    [Nolan ✓]      [Villeneuve]

  Selected (3):  [Shah Rukh Khan ✗] [Alia Bhatt ✗] [Nolan ✗]
```

- Search + popular people grid (filtered to Acting/Directing), minimum **3** selections
- Initializes `User → Director/Actor : AFFINITY` edges in the taste graph
- **Key Spotify parallel:** Like picking artists — the system now knows your taste anchors
- Stored as `FavoritePerson` records (TMDB person ID + metadata)

#### Step 7 — Origin Film (`/onboarding/origin`)

An optional single "film that made you fall in love with cinema" — a high-weight emotional anchor used to seed the taste vector. Skippable.

#### Step 8 — Movie Selection (`/onboarding/movies`)

```
"Pick 5+ movies you love"

  [Poster] [Poster] [Poster] [Poster]
  [Poster] [Poster] [Poster] [Poster]

  Search: [________________]
  Selected (5): [Jawan ✗] [Inception ✗] [Dangal ✗] ...
```

- **Smart defaulting:** shows top-rated films from selected people's filmography (merged, deduplicated, sorted by vote average); falls back to popular movies when no people were picked
- Minimum **5** selections; marks user `onboarded = true` on submission
- Stored as `FavoriteMovie` records (TMDB movie ID + poster/title)

#### Completion (`/onboarding/ready`)

Confirmation screen — the first recommendation feed is generated immediately.

#### Onboarding Output

```
After all 8 steps, the system has:

  ✓ language_preferences         — Step 2 (filters discovery by language)
  ✓ poster-calibration signal    — Step 3 (seeds initial taste direction)
  ✓ mood axes (pace/tone/realism)— Step 4 (default ranking register)
  ✓ platform + theatre prefs     — Step 5 (drives pre-filter & "where to watch")
  ✓ director/actor affinities    — Step 6 (drives people-based recommendations)
  ✓ origin-film anchor           — Step 7 (high-weight emotional seed)
  ✓ explicit movie preferences   — Step 8 (seeds initial taste vector)
  ✓ genre signal                 — inferred from Step 8 movie genres
  ✓ initial cluster assignment   — nearest Cinematic Tribe by movie overlap

First recommendation feed generated immediately — no waiting.
```

#### Why This Works (Spotify Principle)

```
Spotify:    Languages → Artists → Songs from those artists
SlateClub:  Languages → People  → Movies from those people

Each step:
  1. Reduces the search space
  2. Personalizes the next step's suggestions
  3. Gives the user agency (search + browse)
  4. Produces a stronger signal than random "pick 5 films"
```

#### Supplementary Cold Start Paths

- **Letterboxd CSV import:** User exports and uploads watch history (`app/routes/imports.py`). Generates a taste vector from historical ratings, bypassing the 8-step onboarding flow.
- **New Film cold start:** Content vector computed immediately from TMDB metadata + NLP on synopsis. Visual embedding from poster via CLIP model. Film surfaced via content-based layer from day zero. Collaborative signal accumulates within 48–72h.
- **Fallback:** If user skips onboarding, system defaults to trending/popular films filtered by detected locale.

---

### 1.8 Taste Calibration Loop

The first 48 hours after onboarding are critical. The system runs an active calibration loop to rapidly correct the initial taste vector using targeted feedback.

#### Calibration Trigger Schedule

| Timing | Prompt | Purpose |
|---|---|---|
| After first 3 recommendations watched | "How are we doing? Rate our picks so far." (1–5 accuracy score) | Baseline satisfaction signal |
| After 24 hours | Pairwise preference: "Which feels more like you?" (Film A vs Film B) × 3 pairs | Disambiguates close taste clusters |
| After 48 hours | "Your taste profile is ready. Anything feel off?" + editable Taste Identity card | User-correctable taste vector; drives trust |

#### Pairwise Preference Engine

```
Input:  Two films from different regions of the user's candidate space
        (one from primary cluster, one from adjacent cluster)

Display:
  ┌──────────────┐    ┌──────────────┐
  │  [Poster A]  │ vs │  [Poster B]  │
  │  Film A      │    │  Film B      │
  │  "cerebral"  │    │  "visceral"  │
  └──────┬───────┘    └──────┬───────┘
         │                    │
    [This one]          [This one]       [Both] [Neither]

Output: Binary preference signal → adjusts taste vector by +0.1 toward
        chosen film's embedding, -0.1 away from rejected film's embedding.
        "Both" and "Neither" are valid — they adjust cluster membership weights.
```

Film pairs are selected to maximize information gain: the two films should be dissimilar from each other (cosine similarity < 0.3) but both plausibly relevant to the user's emerging taste vector.

#### Calibration Exit Criteria

The calibration loop ends when any of these conditions are met:
- User has rated ≥ 10 films (sufficient behavioral signal)
- 7 days have passed since signup (avoid prompt fatigue)
- User explicitly dismisses calibration prompts twice (respect user agency)

After calibration exits, the system transitions to the standard Feedback Loop (Section 1.6) for continuous learning.

---

## 2. Movie Page Design

The film page is where discovery becomes decision. Every element is designed to reduce friction and deepen engagement.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOVIE PAGE — FULL LAYOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[HERO]
  Full-bleed poster with mood-gradient overlay at bottom
  Title                  Oldboy
  Director · Year        Park Chan-wook · 2003
  Runtime · Language     120 min · Korean
  Certificate            R / 18
  Tone chips:            [psychological] [non-linear] [dark] [revenge]

[QUICK ACTIONS]
  [+ Watchlist]   [✓ Watched]   [★ Rate]   [✍ Review]

[STREAMING]
  Free:  [MUBI]
  Rent:  [Prime Video · $3.99]  [Apple TV · $3.99]
  (Greyed out platforms not available in your region)

[TRAILER]
  Inline YouTube embed (autoplay on scroll-into-view, muted)

─────────────────────────────────────────────────────────────

[RATINGS]
  Global score:   ████████░░  4.3 / 5     (47,200 ratings)
  Your friends:   ★★★★½       avg 4.5     (4 friends watched)
  IMDb:           8.4 / 10
  Letterboxd:     4.4 / 5
  Metacritic:     80 / 100

─────────────────────────────────────────────────────────────

[YOUR TASTE MATCH]                          ← Personalization
  ╔══════════════════════════════════════╗
  ║  92% match for you                   ║
  ║  Because you loved: Burning, Parasite║
  ║  Vibe: Psychological thriller ·      ║
  ║        moral ambiguity · non-linear  ║
  ╚══════════════════════════════════════╝
  [→ Similar vibe films]
  [→ View your Taste Identity]

─────────────────────────────────────────────────────────────

[REVIEWS]
  Sort by:  [Most Helpful ▾]  [Recent]  [Your Tribe]
  Filter:   [All]  [Friends]  [Critics]  [Your Cluster]

  ┌──────────────────────────────────────────────────────┐
  │ ★★★★★  @aritra_watches  · Korean Noir Devotee       │
  │ "The corridor scene alone earns its place in the    │
  │  canon. But it's the final revelation that reframes │
  │  everything..."                          [Helpful 42]│
  └──────────────────────────────────────────────────────┘
  [Load 24 more reviews]

─────────────────────────────────────────────────────────────

[SOCIAL]                                    ← Social layer
  Friends who watched:
  [avatar] [avatar] [avatar]  + Priya & 2 others

  "5 people from your Korean Noir Tribe watched this month"

  [→ Discussion  · 18 comments]

─────────────────────────────────────────────────────────────

[YOUR TASTE IDENTITY]                       ← Profile-linked
  ╔══════════════════════════════════════╗
  ║  Your Cinematic Identity             ║
  ║                                      ║
  ║  Slow Cinema × Psychological Thriller║
  ║  × Neo-Noir                          ║
  ║                                      ║
  ║  Pace:      ████████░░  slow-burn    ║
  ║  Tone:      ███████░░░  dark         ║
  ║  Structure: ██████░░░░  non-linear   ║
  ║                                      ║
  ║  Top affinities:                     ║
  ║  Park Chan-wook · Villeneuve · Bong  ║
  ║                                      ║
  ║  Tribe: Korean Noir Devotees         ║
  ╚══════════════════════════════════════╝
  (This card appears on your profile page. On film pages, the taste
   match score above is derived from this identity.)

─────────────────────────────────────────────────────────────

[FILM INSIGHTS]                             ← Insights layer
  Popularity trend (30 days):  ↑ Rising
  ▂▃▄▅▇████ (sparkline)

  Audience sentiment:
  ████████░░  Loved (78%)
  ██░░░░░░░░  Mixed (16%)
  █░░░░░░░░░  Disliked (6%)

  "Most loved by:"
  [Korean Noir Devotees] [Slow Cinema Collective] [90s Arthouse]

─────────────────────────────────────────────────────────────

[MORE LIKE THIS]
  Director's other films: [Sympathy for Mr. Vengeance] [JSA] [The Handmaiden]
  Similar tone:           [I Saw the Devil] [Memories of Murder] [A Prophet]
  "If you liked the cinematography...": [Chungking Express] [In the Mood for Love]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### User Action Flows

| Action | Flow |
|---|---|
| **Rate** | Half-star tap → confirm modal (optional) → stored immediately as explicit signal → taste vector updated |
| **Review** | Text field (500 chars) + optional tone tags ([psychological] [slow-burn]) + spoiler toggle → submitted → NLP pipeline runs → review ranked by helpfulness |
| **Watchlist** | Instant add → confirmed by icon animation → synced to profile → feeds next recommendation cycle |
| **Watched** | Tap → "How was it?" prompt appears immediately → converts to rating action (drives conversion funnel) |
| **Share** | Deep link to film page with taste match score pre-filled |

---

## 3. System Design

### Core Services

> **As-built:** The decomposition below is a **logical** view. Today these responsibilities are served by **one FastAPI process** (`backend/app/main.py`) using modular routers (`app/routes/`) and services (`app/services/`) against a single PostgreSQL database — not separately deployed microservices, a standalone event bus, or a separate ML service. The split is the target topology for scale-out; the boundaries (router/service/model trio per domain) are already respected in code so the carve-out is mechanical when needed.

```
┌──────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                              │
│              Auth validation · Rate limiting · Routing           │
└──────┬───────────┬───────────┬───────────┬────────────┬──────────┘
       │           │           │           │            │
  ┌────▼────┐ ┌────▼────┐ ┌───▼─────┐ ┌──▼──────┐ ┌──▼──────┐
  │  USER   │ │CONTENT  │ │ SOCIAL  │ │  RECOM- │ │ SEARCH  │
  │SERVICE  │ │SERVICE  │ │SERVICE  │ │MENDATION│ │SERVICE  │
  │         │ │         │ │         │ │SERVICE  │ │         │
  │Auth     │ │Catalog  │ │Reviews  │ │Pipeline │ │Full-text│
  │Profile  │ │Metadata │ │Ratings  │ │Taste    │ │Movie    │
  │Watch    │ │Streaming│ │Comments │ │  vector │ │Person   │
  │ history │ │ avail.  │ │Follow   │ │Graph    │ │Review   │
  │Prefs    │ │Search   │ │Activity │ │Feed gen │ │search   │
  │Devices  │ │ index   │ │  feed   │ │Explain  │ │         │
  └────┬────┘ └────┬────┘ └────┬────┘ └──┬──────┘ └─────────┘
       │           │           │          │
  ┌────▼───────────▼───────────▼──────────▼────────────────────┐
  │                        EVENT BUS                            │
  │  user.watched  user.rated  user.reviewed  user.saved        │
  │  swipe.accept  swipe.reject  movie.viewed  search.query     │
  │  follow.created  review.helpful                             │
  └──────────────────────────┬─────────────────────────────────┘
                             │
                  ┌──────────▼──────────┐
                  │   SIGNAL PROCESSOR  │
                  │                     │
                  │ Consumes events     │
                  │ Aggregates features │
                  │ Writes feature store│
                  │ Triggers ML jobs    │
                  └──────────┬──────────┘
                             │
           ┌─────────────────▼──────────────────────┐
           │              ML PLATFORM                │
           │                                         │
           │  ┌───────────┐   ┌─────────────────┐   │
           │  │  Feature  │   │  Model Registry │   │
           │  │   Store   │   │  (MLflow)       │   │
           │  └───────────┘   └─────────────────┘   │
           │                                         │
           │  ┌───────────┐   ┌─────────────────┐   │
           │  │  Vector   │   │   Taste Graph   │   │
           │  │   Store   │   │   (graph DB)    │   │
           │  │ (ANN idx) │   │                 │   │
           │  └───────────┘   └─────────────────┘   │
           │                                         │
           │  ┌───────────────────────────────────┐  │
           │  │   Model Serving                   │  │
           │  │   Two-tower · ALS · XGBoost       │  │
           │  └───────────────────────────────────┘  │
           └─────────────────────────────────────────┘
```

### Data Flow

```
1. User action (e.g., rates a film 5 stars)
   → API Gateway validates JWT
   → Routes to Social Service
   → Social Service persists rating to DB
   → Emits event: user.rated { user_id, movie_id, value: 5, timestamp }

2. Event Bus delivers event to Signal Processor
   → Signal Processor aggregates into Feature Store
   → Triggers nightly taste-vector recompute job (marks user as dirty)

3. Recommendation Service (on next feed request)
   → Reads user taste vector from Feature Store
   → Queries Vector Store for ANN retrieval
   → Queries Graph DB for cluster/friend signals
   → Runs pipeline (filter → rank → contextualize)
   → Returns ordered feed + explanations

4. ML Platform (background)
   → Nightly: recomputes taste vectors for all dirty users
   → Weekly: retrains two-tower model
   → Weekly: re-runs Louvain community detection
```

### Service Responsibilities (Clean Separation)

| Service | Owns | Does NOT own |
|---|---|---|
| **User Service** | Identity, profile, watch history, devices | Movie data, recommendations |
| **Content Service** | Movie catalog, metadata, streaming availability | User data, social features |
| **Social Service** | Reviews, ratings, follows, comments, activity feed | Recommendations, movie data |
| **Recommendation Service** | Taste vectors, pipeline, feed generation, explanations | Storing reviews, auth |
| **Search Service** | Full-text index, autocomplete | Recommendations, social graph |
| **Signal Processor** | Event consumption, feature aggregation | Serving API responses |

### Project Folder Structure

```
slateclub/
│
├── frontend/                                 # Next.js 16.2.3 (App Router, Turbopack) · React 19 · TS · Tailwind v4
│   ├── public/
│   ├── src/
│   │   ├── app/                              # App Router pages (route groups)
│   │   │   ├── (auth)/                       # login, signup, layout.tsx
│   │   │   ├── (main)/                       # Shared authed layout (mobile tab nav)
│   │   │   │   ├── home/                     # Swipe stack feed
│   │   │   │   ├── discover/                 # Discovery + mood filter
│   │   │   │   ├── film/[slug]/              # Movie page (Section 2)
│   │   │   │   ├── slates/                   # + [id]/, new/   — curated collections
│   │   │   │   ├── circles/                  # + [id]/         — private taste circles
│   │   │   │   ├── tribe/                    # Cinematic Tribe view
│   │   │   │   ├── artists/[tmdbId]/         # Artist/director profiles
│   │   │   │   ├── festivals/[slug]/         # Festivals
│   │   │   │   ├── releases/                 # Release calendar (theatrical + OTT)
│   │   │   │   ├── parties/[id]/             # Watch parties
│   │   │   │   ├── chapters/                 # + [slug]/       — local cinema clubs
│   │   │   │   ├── profile/                  # + [username]/   — profile + Taste Identity
│   │   │   │   ├── settings/                 # + import/       — Letterboxd CSV import
│   │   │   │   ├── community/                # Social feed
│   │   │   │   ├── activity/                 # Activity feed
│   │   │   │   ├── search/                   # Full-text search
│   │   │   │   └── notifications/            # Notification center
│   │   │   ├── onboarding/                   # 8-step "Tune Your Taste" (Section 1.7)
│   │   │   │   ├── welcome/   languages/  posters/  mood/
│   │   │   │   ├── platforms/ people/     origin/   movies/
│   │   │   │   ├── ready/                    # completion
│   │   │   │   └── layout.tsx                # progress shell (TOTAL_STEPS = 8)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx                      # Root redirect
│   │   ├── components/                       # Feature-grouped (18 domains)
│   │   │   ├── feed/                         # HeroFan, ForYouGrid, BrowseGrid,
│   │   │   │                                 #   FeedScopeTabs, SessionMoodPrompt, MovieSearchBar
│   │   │   ├── film/  discover/  slates/  social/  discourse/  releases/
│   │   │   ├── taste/                        # TasteIdentityCard, TribeLabel, TasteDriftBanner
│   │   │   ├── taste-engine/                 # BubbleConstellation (GSAP), SentenceBuilder, SwapSheet
│   │   │   ├── onboarding/                   # MoodSlider, StepShell, OnboardingProgress, NextButton
│   │   │   ├── calibration/                  # AccuracyRating, PairwisePicker
│   │   │   ├── micro-feedback/               # MicroFeedbackBar
│   │   │   ├── ratings/  cultural/  theatres/  notifications/  layout/
│   │   │   └── ui/                           # Button, Modal, Skeleton, Pill, CardStack, ...
│   │   ├── stores/                           # Zustand
│   │   │   ├── authStore.ts
│   │   │   ├── feedStore.ts                  # Session mood (2h expiry)
│   │   │   ├── onboardingStore.ts            # 8-step form state + per-step submit actions
│   │   │   └── socialStore.ts
│   │   ├── lib/
│   │   │   ├── api.ts                        # apiFetch<T> + JWT refresh on 401
│   │   │   ├── nav.ts                        # MOBILE_NAV_ITEMS
│   │   │   ├── design-tokens.ts  poster-color.ts  constants.ts
│   │   └── types/                            # discourse, movie, notifications,
│   │       │                                 #   onboarding, slates, social, user
│   │       └── ...
│   ├── package.json                          # GSAP: add when first needed (not yet installed)
│   └── tsconfig.json
│
├── backend/                                  # Unified Python 3.12 · FastAPI · SQLAlchemy 2.0 (async) · asyncpg
│   ├── app/
│   │   ├── main.py                           # FastAPI app ("SlateClub API" v2.0); registers all_routers
│   │   ├── core/
│   │   │   ├── config.py                     # pydantic-settings from .env
│   │   │   ├── database.py                   # async engine + Base + session
│   │   │   ├── auth.py                       # JWT (python-jose) + bcrypt
│   │   │   └── neo4j_client.py               # Neo4j async driver
│   │   ├── routes/                           # 32 routers (registered in routes/__init__.py)
│   │   │   ├── auth · users · onboarding · imports          # identity + onboarding
│   │   │   ├── movies · discover · releases · festivals · theatres · cultural
│   │   │   ├── ratings · reviews · comments · watchlist · watch_history · feedback
│   │   │   ├── follows · activity · feed · notifications · critics
│   │   │   ├── slates · circles · chapters · discourse · watch_parties · artists
│   │   │   └── recommendations · anchors · tribes · taste · taste_engine
│   │   ├── models/                           # 17 model files (~51 tables)
│   │   │   ├── user (User, UserPreferences, UserTasteState) · movie (+ identity_json/embedding)
│   │   │   ├── actions · social · onboarding · taste_engine
│   │   │   └── slates · discourse · notifications · artists · releases · cultural
│   │   │       festivals · theatres · watch_parties · circles · chapters
│   │   ├── services/                         # impressions · notify · trending · releases
│   │   │   └── similar_films · taste_embedding
│   │   ├── ml/
│   │   │   ├── embeddings/taste_vector.py    # 25-dim taste vector (Phase 3–4)
│   │   │   ├── graph/                        # taste_graph · community (Louvain) · graph_recommend
│   │   │   ├── llm/                          # openai_client · movie_identity (9-axis) · taste_identity
│   │   │   │                                 #   taste_describer · drift_detector · contextual_bandit
│   │   │   ├── models/                       # als · content_based · two_tower (stub) · xgboost_ranker
│   │   │   ├── pipeline/recommendation_pipeline.py   # 4-stage funnel (Section 1.5)
│   │   │   └── recommendationengine.py       # implemented-vs-scaffolded status doc
│   │   ├── integrations/tmdb.py              # TMDB client (only external integration wired)
│   │   └── data/                             # seed fixtures
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/                         # 18 migrations: 0001_onboarding_signals …
│   │                                         #   0016_movie_identity · 0017_user_taste_state · 0018_impression_source
│   ├── bootstrap_db.py                       # Base.metadata.create_all (one-time base schema)
│   ├── requirements.txt
│   └── .env
│
├── frontend/.env.local                       # NEXT_PUBLIC_API_URL
├── ARCHITECTURE.md                           # This file
├── CLAUDE.md · vision.md                      # Product/agent docs
└── figma-screens/                            # PNG design references (no code)
```

### API & Service Dependencies (Phased)

Not everything is needed from day one. APIs and services activate as the product matures. **Status** reflects what is wired in the current codebase (✅ wired · ⏳ planned).

#### Phase 1–2: Core Product (start here)

| Dependency | Type | Status | What It Powers |
|---|---|---|---|
| **TMDB API** | External API | ✅ wired | Movie catalog, posters, cast, genres, synopses — the entire content layer |
| **PostgreSQL** | Database | ✅ wired | Users, watchlists, ratings, reviews, watch history (async SQLAlchemy + asyncpg) |
| **JWT** | Auth | ✅ wired | Access + refresh tokens (python-jose), bcrypt password hashing |
| **Google OAuth + Apple Sign-In** | Auth provider | ⏳ planned | Social login — not yet implemented (current auth is email/password) |

#### Phase 3–4: Recommendation Engine + Taste Graph

| Dependency | Type | Status | What It Powers |
|---|---|---|---|
| **Neo4j** | Graph database | ✅ wired | Taste graph, user-user similarity, Cinematic Tribes (python-louvain) |
| **OpenAI API** | LLM API | ✅ wired | Movie identity (9-axis), taste statements, semantic embeddings |
| **OMDb API** | External API | ⏳ planned | IMDb/Rotten Tomatoes/Metacritic scores on film pages |
| **Watchmode API** | External API | ⏳ planned | "Watch on Netflix/Mubi/Prime" streaming availability |
| **Weaviate** (or Pinecone) | Vector store | ⏳ planned | Dedicated ANN index — embeddings currently held in Postgres/memory |

#### Phase 5: Advanced Personalization

| Dependency | Type | Status | What It Powers |
|---|---|---|---|
| **Anthropic Claude API** | LLM API | ⏳ available | SDK installed as an alternative LLM provider; not currently called |
| **Typesense** | Search engine | ⏳ planned | Sub-50ms full-text search across movies, reviews, people |
| **PyTorch / sentence-transformers / CLIP** | ML | ⏳ planned | Full two-tower training + visual/semantic embeddings |

> **Note:** YouTube trailer links are pulled from TMDB's video metadata — no separate YouTube Data API key needed.

---

## 4. Tech Stack, Data & APIs

### Frontend

| Layer | Technology | Status |
|---|---|---|
| Web framework | **Next.js 16.2.3** (App Router, Turbopack) + TypeScript | ✅ |
| UI runtime | **React 19.2** | ✅ |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`) + `geist` font | ✅ |
| Animation (components) | **Framer Motion 12** | ✅ |
| Animation (choreography) | **GSAP** — for taste-engine constellation | ⏳ add when first needed |
| State | **Zustand 5** | ✅ (authStore, feedStore, onboardingStore, socialStore) |
| Data fetching | **TanStack Query 5** | ✅ installed |
| Mobile | Mobile-web parity (responsive, ≥44px targets); native app | ⏳ not started |

### Backend Services

| Layer | Technology | Status |
|---|---|---|
| API + ML (unified) | **Python 3.12 + FastAPI** | ✅ single process serving routers + ML |
| ORM + migrations | **SQLAlchemy 2.0 (async) + asyncpg + Alembic** | ✅ (18 migrations; ~51 tables) |
| Primary database | **PostgreSQL 17** — port **5433**, database `slateclub` | ✅ |
| Graph database | **Neo4j** | ✅ Louvain community detection (Cinematic Tribes) |
| Session & cache | **Redis** | ⏳ planned |
| Vector store | **Weaviate** (or Pinecone) | ⏳ planned |
| Full-text search | **Typesense** | ⏳ planned |
| Job queues / real-time | **BullMQ / Socket.io** | ⏳ planned |

### ML Stack

| Component | Technology | Status |
|---|---|---|
| Numerics | **NumPy · SciPy · scikit-learn** | ✅ installed |
| Collaborative filtering | **ALS** (`app/ml/models/als.py`) | ✅ trains once ~10+ interactions exist |
| Ranking model | **XGBoost** | ✅ (weighted-sum fallback until ~50 interactions) |
| Community detection | **python-louvain** + **NetworkX** | ✅ |
| LLM (descriptions, movie identity) | **OpenAI** `gpt-5.5` | ✅ wired |
| Embeddings | **OpenAI** `text-embedding-3-large` | ✅ wired |
| LLM (alternative provider) | **Anthropic** SDK | ⏳ installed, not called |
| Neural model training | **PyTorch** (two-tower) | ⏳ Phase 5 (current two-tower is a random-projection stub) |
| Sentence / visual embeddings | **sentence-transformers** · **CLIP** | ⏳ Phase 5 (not installed) |
| Experiment tracking | **MLflow** | ⏳ planned |
| Feature store | **Custom PostgreSQL** (migrate to Feast at scale) | ⏳ Redis layer planned |

### External Data Sources

| Source | Data Provided | Status |
|---|---|---|
| **TMDB API** | Movie metadata: title, cast, crew, synopsis, poster, release date, genres, language, runtime; trailers via video metadata | ✅ wired (`app/integrations/tmdb.py`) |
| **Watchmode API** | Streaming availability by region and platform | ⏳ planned |
| **OMDb API** | IMDb rating, Rotten Tomatoes score, Metacritic score | ⏳ planned |
| **YouTube Data API** | Extended trailer/clip search beyond TMDB | ⏳ optional |
| **Open Subtitles API** | Subtitle text for future content analysis | ⏳ optional |

### Authentication

- **JWT** — access + refresh tokens via **python-jose**; **bcrypt** (passlib) password hashing. Routes: `signup`, `login`, `refresh`, `logout`, `me` (`app/routes/auth.py`).
- **Letterboxd CSV import** — `app/routes/imports.py` ingests watch history for taste-vector bootstrap (no OAuth; user exports and uploads).
- **OAuth 2.0** (Google / Apple Sign-In) — ⏳ planned; not yet implemented.
- **Session invalidation / Redis-backed refresh tokens** — ⏳ planned.

---

## 5. Scalability & Differentiation

### How the System Improves Over Time

The system is designed so that **user growth compounds recommendation quality**, not just engagement metrics.

```
More users
  → denser taste graph
    → better community detection
      → higher-signal cluster-based recommendations
        → better discovery
          → more engagement
            → more users  ↺
```

Specific improvement trajectories:

| Timeline | What Improves |
|---|---|
| Week 1 | Cold-start users get decent recommendations via content-based matching |
| Month 1 | Taste clusters form; cluster-consensus signals begin working |
| Month 6 | Two-tower model trains on sufficient positive/negative pairs; quality jump |
| Year 1 | LLM taste descriptions become deeply personalized; review NLP matures |
| Year 3 | System detects "mood cycles" (users binge specific tones in specific seasons) |
| Year 5 | Director/festival circuit affinity graphs predict taste for unreleased films |

### What Makes It Hard to Replicate

| Moat | Why It Compounds |
|---|---|
| **Taste Graph** | Proprietary social graph of cinematic taste. Every interaction adds an edge. Takes years of real user behavior. Cannot be purchased or cloned. |
| **Review NLP Corpus** | Film-specific vocabulary ("Tarkovsky pacing," "elliptical editing") that generic sentiment models miss. Improves with every review written. |
| **Mood-Aware Vectors** | Multi-dimensional taste model captures nuance (tone × pace × structure) that genre tags cannot. Grows more accurate with more rated films per user. |
| **Cinematic Tribe Identity** | Users build social identity around their cluster. Drives retention independent of recommendation quality — social belonging is sticky. |
| **Cross-Surface Coherence** | One taste model feeds swipe feed, discovery page, and film page simultaneously. Signals from all surfaces reinforce each other; fragmented competitors can't do this. |
| **Taste Identity Lock-in** | Users see and share their cinematic identity — dimensions, genre blend, tribe membership. Leaving SlateClub means losing your taste profile, your "Slow Cinema × Neo-Noir" label, your match scores. This is personal data that becomes part of self-concept — stickier than a watchlist export. |

### Long-Term Taste Data Advantage

The recommendation engine is a **compounding asset**, not a feature.

- A new entrant copying the UI tomorrow gets a blank model. Every user who watches, rates, and reviews on SlateClub is depositing compound interest into the taste graph.
- When the taste graph reaches critical mass within a taste cluster, recommendations become dramatically better than any new entrant can achieve — even with superior infrastructure.
- The "cinematic tribe" social layer creates network lock-in: leaving SlateClub means losing your taste cluster, your tribe, your taste match scores with friends. This is the retention flywheel that Letterboxd never built.

### Prototype-to-Production Path

**Current position:** ~**Phase 4** — taste graph wired (Neo4j + Louvain), full route surface (32 routers), ~51 tables across 18 migrations, 8-step onboarding live. **Phase 5 is scaffolded**: the LLM layer runs on OpenAI (taste statements, movie identity, drift detection, contextual-bandit segmentation), while the full PyTorch two-tower and dedicated vector/search stores remain pending.

```
Prototype (done)
├── Static HTML UIs: Home, Discover, TasteEngine
└── No backend

Phase 1 — Real Data ✅
├── Next.js frontend consuming TMDB
├── PostgreSQL: users, watchlists, ratings
├── Auth (JWT email/password; OAuth pending)
└── 8-step onboarding (languages → posters → mood → platforms → people → origin → movies)

Phase 2 — Social Core ✅
├── Reviews, comments, following, activity feed
├── Basic content-based recommendations (cosine similarity)
├── Taste calibration loop (pairwise preferences)
└── Micro-feedback signals v1 ("not in the mood", "more like this")

Phase 3 — Recommendation Engine V1 ✅ (two-tower stubbed)
├── ALS collaborative filtering
├── Two-tower model — random-projection placeholder (full training = Phase 5)
├── 25-dim taste vector computation pipeline
├── Session mood prompt ("What are you in the mood for?")
└── Explore/exploit ratio (70/30 split)

Phase 4 — Taste Graph ✅
├── Neo4j graph DB + Louvain clustering
├── Tribe UI ("Your Cinematic Tribe")
└── Graph-powered recommendation layer

Phase 5 — LLM Layer & Advanced Personalization ◻ scaffolded
├── LLM taste descriptions + semantic retrieval (OpenAI) ✅
├── Taste Identity Profile (user-facing) ✅
├── Taste drift detection and phase transitions ✅
├── Contextual bandit for source blending ✅ (segment classifier)
├── Full 4-layer hybrid pipeline — pending trained two-tower ◻
└── Dedicated vector store (Weaviate) + Typesense search ◻
```

---

*Architecture version: 2.0 · Last updated: June 2026*
