# SlateClub v1 — Reference Documentation

> **What it is:** A cinema-grade taste-discovery + community app. Spotify's taste intelligence × Letterboxd's film culture × Reddit/X's live discourse — for film lovers.
>
> **Built:** April 2026. Status: working MVP, full Phase 1–4 vision implemented (21 feature modules). Backend: 177 routes. Frontend: ~50 pages/components. Type-checks clean.

---

## 1. Quick start

```bash
# Backend (one terminal)
cd backend
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
psql -U postgres -c "CREATE DATABASE slateclub;"
uvicorn app.main:app --reload --port 8000

# Frontend (second terminal)
cd frontend
npm install
npm run dev
```

App: http://localhost:3000 · API docs: http://localhost:8000/docs

**Optional services** (the app degrades gracefully without them):
- Neo4j on `bolt://localhost:7687` for taste-graph queries
- Anthropic API key in `.env` for LLM tone extraction + taste statements

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) · TypeScript · Tailwind v4 · Framer Motion · Zustand · TanStack Query |
| Backend | FastAPI · async SQLAlchemy 2 · asyncpg · Pydantic v2 · Alembic |
| Database | PostgreSQL (primary) · Neo4j (taste graph, optional) |
| ML | NumPy · scikit-learn · XGBoost · custom 25-dim taste vectors |
| Auth | JWT in HttpOnly cookies (access 15min + refresh 7d) · bcrypt passwords |
| External | TMDB (films + people + posters) · Anthropic Claude (LLM, optional) |
| Design | Geist Sans (display) + Inter (body) · cinema-dark palette · pill colour taxonomy |

---

## 3. Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          BROWSER                                 │
│  Next.js · TopNav (desktop) / MobileTabBar (≤lg)                 │
└─────────────────┬───────────────────────────────────────────────┘
                  │ apiFetch (cookie auth)
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       FastAPI (177 routes)                       │
│  routes/ → models/ → DB     ml/pipeline/ for personalised feeds  │
│  integrations/tmdb.py for film catalog + people                  │
└─────────────────┬───────────────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                    ▼
   ┌─────────┐         ┌──────────┐
   │Postgres │         │   Neo4j  │  (optional: taste graph)
   │ ~30 tbls│         │ User-Movie-Director nodes
   └─────────┘         └──────────┘
```

**Personalisation flow:**
```
Onboarding → onboarding_signals + language_selections + favorite_*
            ↓
load_user_priors() → seed_prior_vector + languages + mood_*
            ↓
hydrate_catalog_for_languages() ← fills local Movie cache from TMDB
            ↓
4-stage pipeline (candidate gen → prefilter → rank → contextualize)
            ↓
Hero card / For-You / Discover Trending
```

---

## 4. Backend reference

### 4.1 Database models (Postgres tables)

Core entities live in `backend/app/models/`. All use SQLAlchemy 2.0 async.

| File | Tables | Notes |
|---|---|---|
| `user.py` | `users`, `user_preferences` | Auth + per-user toggles |
| `movie.py` | `movies` | Lazy-cached from TMDB. `tmdb_id` is canonical |
| `actions.py` | `ratings`, `watchlist_items`, `watch_history`, `reviews`, `comments` | User actions on films |
| `social.py` | `follows`, `activity_events`, `micro_feedbacks`, `calibration_responses` | Social graph + signals |
| `onboarding.py` | `language_selections`, `favorite_people`, `favorite_movies`, `onboarding_signals` | The 8-step signals |
| `taste_engine.py` | `taste_presets` | Saved Discover sentences |
| `slates.py` | `slates`, `slate_films`, `slate_collaborators`, `slate_saves`, `slate_room_messages` | Curated film collections + chat |
| `discourse.py` | `hot_takes`, `hot_take_reactions`, `polls`, `poll_votes`, `review_votes` | Short-form discussion |
| `notifications.py` | `notifications` | Activity grouped by kind |
| `artists.py` | `artists`, `artist_posts`, `amas`, `ama_questions`, `artist_follows` | Verified artist layer |
| `releases.py` | `releases` | Theatre + OTT release calendar |
| `cultural.py` | `cultural_contexts` | Optional pre-watch context cards |
| `festivals.py` | `festivals`, `festival_posts` | Live festival mode |
| `theatres.py` | `theatres`, `showtimes` | Now Showing |
| `watch_parties.py` | `watch_parties`, `watch_party_participants`, `watch_party_reactions` | Synced viewing |
| `circles.py` | `taste_circles`, `taste_circle_members`, `taste_circle_messages` | Private 6–12 person groups |
| `chapters.py` | `chapters`, `chapter_members`, `chapter_events` | City-level communities |

Schema is auto-created on first uvicorn startup via `Base.metadata.create_all()`. Alembic migrations also exist (`backend/alembic/versions/0001_…` through `0014_…`) for production use — run `alembic stamp head` once on a working DB to switch over.

### 4.2 Routes — full inventory

All under `/api/`. 177 endpoints across 27 routers.

#### Auth (`auth.py`)
- `POST /auth/signup` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me`

#### Users (`users.py`)
- `GET /users/search?q=&limit=` — fuzzy by name/username
- `GET /users/{username}` — public profile (counts + bio)
- `GET /users/{username}/twin-score` — Jaccard of film sets + high-rating overlap boost
- `GET /users/{username}/films-youd-both-love` — popular films neither has logged
- `GET /users/{username}/mutual-twins` — shared followees
- `GET /users/me/profile` · `/me/watchlist` · `/me/watched` · `/me/ratings` · `/me/languages` · `/me/preferences`
- `PATCH /users/me` · `PATCH /users/me/preferences`

#### Onboarding (`onboarding.py`) — the 8-step funnel
- `POST /onboarding/welcome` — marks `welcomed_at`
- `POST /onboarding/languages` — replaces `LanguageSelection` rows
- `GET /onboarding/posters/set?count=18` — random slice from the curated 35-poster seed
- `POST /onboarding/posters` — saves `poster_picks: int[]`
- `POST /onboarding/mood` — saves three slider values [-1, 1]
- `POST /onboarding/platforms` — saves platform list + `prefers_theatres`
- `GET /onboarding/people/search?q=` · `POST /onboarding/people` — favourite directors/actors
- `POST /onboarding/origin` — saves `origin_film_tmdb_id`
- `GET /onboarding/movies/search` · `POST /onboarding/movies` — favourite films + sets `user.onboarded=True`
- `GET /onboarding/summary` — counts for the Step 8 reveal screen
- `GET /onboarding/status` — current completion state

#### Movies (`movies.py`)
- `GET /movies/search?q=` — TMDB search
- `GET /movies/trending?language=` — TMDB trending (language= switches to discover with that filter)
- `GET /movies/popular?language=&page=` · `GET /movies/top-rated?language=&page=`
- `GET /movies/discover?...` — full TMDB discover passthrough
- `GET /movies/{tmdb_id}` — film detail (lazy upserts into local cache)
- `GET /movies/{tmdb_id}/status` — `{ inWatchlist, watched, rating }`
- `POST/DELETE /movies/{tmdb_id}/watchlist`
- `POST/DELETE /movies/{tmdb_id}/watched`
- `POST /movies/{tmdb_id}/rate` (`{ rating: 0..5 }`, 0 clears)

#### Recommendations (`recommendations.py`)
- `GET /recommendations/for-you?session_mood=&page=` — full ML pipeline
- `GET /recommendations/session-moods` — vocabulary
- `GET /recommendations/debug` — diagnostic dump (onboarding signals + cache counts + diagnostics)

Helpers exposed: `load_user_priors()`, `hydrate_catalog_for_languages()` — both reused by `feed.py` and `discover.py`.

#### Feed (`feed.py`)
- `GET /feed/hero` — 1 hero + 3 stack-behind films via the recommendation pipeline
- `GET /feed/twins-now` — films watched in the last 90 minutes by other users

#### Discover (`discover.py`)
- `GET /discover/trending` — top 10 by popularity, biased by user languages when logged in
- `GET /discover/by-platform` · `GET /discover/awards` · `GET /discover/artists-radar`

#### Activity (`activity.py`)
- `GET /activity/feed?scope=network|artists|world|all`
- `GET /activity/user/{user_id}`

#### Slates (`slates.py`)
- `POST /slates` · `GET /slates/{id}` · `PATCH /slates/{id}` · `DELETE /slates/{id}`
- `POST/DELETE /slates/{id}/films/{tmdb_id}` · `PATCH /slates/{id}/films/{tmdb_id}/note`
- `POST /slates/{id}/collaborators` · `POST/DELETE /slates/{id}/save`
- `GET /slates/mine` · `/saved` · `/featured` · `/from-twins`
- `GET/POST /slates/{id}/room` — Slate Room messages

#### Taste Engine (`taste_engine.py`)
- `GET /taste-engine/options` — vocabulary per slot
- `GET /taste-engine/match-count?mood=&genre=&language=&platform=&era=` — live count (auto-augments TMDB if local cache < 20)
- `POST /taste-engine/query` — top 30 with relevance score for the bubble constellation
- `GET/POST /taste-engine/presets` — saved sentences

#### Discourse (`discourse.py`)
- `POST/GET /hot-takes` (`?feed=world|network`, `?tmdbId=`) · `DELETE /hot-takes/{id}` · `POST /hot-takes/{id}/react`
- `POST/GET /polls` · `POST /polls/{id}/vote`
- `POST /reviews/{id}/vote` · `GET /reviews/{id}/votes`

#### Notifications (`notifications.py`)
- `GET /notifications` · `/unread-count` · `POST /{id}/read` · `POST /read-all`

Dispatched from `services/notify.py`, hooked into follow / slate-save / review-helpful / slate-message events.

#### Artists (`artists.py`)
- `GET /artists/by-tmdb/{tmdb_person_id}` — profile + filmography
- `POST/DELETE /artists/{id}/follow`
- `GET/POST /artists/{id}/posts` (verified-artist-only post)
- `GET /artists/{id}/amas` · `POST /artists/amas/{ama_id}/questions` · `POST /artists/ama-questions/{q_id}/answer`

#### Releases (`releases.py`) · Now Showing (`theatres.py`) · Festivals (`festivals.py`)
- `GET /releases/upcoming?region=&days=` · `GET /releases/film/{tmdb_id}`
- `GET /now-showing/film/{tmdb_id}?city=` · `GET /now-showing/city/{city}`
- `GET /festivals/{active|upcoming|{slug}}` · `GET/POST /festivals/{slug}/posts`

#### Cultural intelligence (`cultural.py`)
- `GET /cultural/filmography/{tmdb_person_id}?order=chronological|best_to_worst&role=`
- `GET /cultural/connector/{tmdb_id}` — threads via shared crew
- `GET/POST /cultural/context/{tmdb_id}` — pre-watch context cards
- `GET /cultural/hidden-gems` — under-rated globally but loved locally

#### Communities (`chapters.py`, `circles.py`, `parties`, `critics.py`)
- Chapters (city groups) · Circles (private 6–12) · Watch Parties · Critic badges (algorithmic)

#### Other (`reviews`, `comments`, `ratings`, `watchlist`, `watch_history`, `feedback`, `taste`, `tribes`, `imports`)
- Standard CRUD + Letterboxd CSV import at `POST /import/letterboxd`

### 4.3 The recommendation pipeline (the actual ML)

Lives at `backend/app/ml/pipeline/recommendation_pipeline.py`. 4 stages, each tunable.

**Stage 1 — Candidate generation** (~500 candidates)
Combines four sources:
- **Content-based** (top 200) — cosine similarity of taste vector vs movie embeddings
- **ALS collaborative filtering** (top 200) — implicit-feedback matrix factorisation (64 factors)
- **Two-tower neural** (top 300) — dual encoder, 64-dim
- **Trending boost** (top 50) — popularity outliers

**Stage 2 — Pre-filtering**
- Drop watched + dismissed (`MicroFeedback.type == "not_for_me"`)
- **Drop films whose `original_language` isn't in the user's `LanguageSelection`** (skipped if user only picked English)
- If filter empties everything, fall back to unfiltered

**Stage 3 — Scoring & ranking** (XGBoost, 10 features)
Trained model in prod; fallback weighted-sum in dev. Features:
1. `taste_similarity` — cosine(user taste vector, movie embedding)
2. `cf_score` — ALS rank
3. `content_score` — content-based rank
4. `two_tower_score` — neural rank
5. `trending_score` — boolean
6. `popularity` — TMDB normalized
7. `recency` — normalized release year
8. `genre_overlap` — count
9. **`language_match`** — 1.0 if user's lang else 0.3
10. **`mood_alignment`** — pacing slider vs runtime distance

Diversity penalty: 3rd+ same-director film in top 10 gets ×0.5.

**Stage 4 — Contextualization**
- Time-of-day boost (late night → short films + horror; morning → comedy/family)
- Session mood OR persistent mood from `OnboardingSignals` boosts matching genres ×1.3
- Explore/exploit split: 70% top-ranked + 30% random from positions 30–130
- Generate human explanations per film
- Assign surface slots (`swipe_stack` / `for_you` / `taste_cluster` / `might_surprise_you`)

### 4.4 Taste vector (the 25-dim embedding)

`backend/app/ml/embeddings/taste_vector.py`

```
dims 0–19:  20 TMDB genre IDs (one-hot)
dim 20:     normalized vote_average
dim 21:     normalized popularity
dim 22:     normalized runtime
dim 23:     release-decade signal
dim 24:     non-English language flag
```

User taste vector = Σ (signal_weight × recency_decay × movie_embedding) / total_weight.

**Cold-start: `seed_prior_vector()`**
Built from onboarding signals:
- `poster_picks` + `origin_film` + `favourite_movies` → averaged movie embeddings (origin weighted 2×)
- `mood_realism` positive → boosts sci-fi/fantasy/animation; negative → drama/doc/history
- `mood_tone` positive → comedy/family; negative → horror/thriller/crime
- `mood_pacing` → moves runtime dim toward long (slow) or short (fast)
- Non-English language → sets dim 24

**Blending** (in `compute_user_taste_vector`):
- `<3` interactions → 60% prior
- `<10` interactions → 20% prior
- `≥10` → pure interaction-based

### 4.5 Catalog hydration — bridging onboarding to recs

`backend/app/routes/recommendations.py:hydrate_catalog_for_languages`

The pipeline ranks from the local `Movie` table. Without hydration, a fresh user with Tamil/Korean languages has 0 candidates in those languages because films are only cached when somebody opens their detail page.

Before each `/for-you` and `/feed/hero` (and `/discover/trending`):
1. Read user's non-English `LanguageSelection`s
2. For each: count existing rows. If < 60, pull `min(3, needed/20)` pages from TMDB `/discover` sorted by popularity
3. Upsert each into local `Movie` (per-row savepoints — one bad row doesn't sink the call)
4. Cache the language-set for 1 hour to avoid re-hammering TMDB

Logs `[hydrate] hydrated N films for user=...` to uvicorn.

---

## 5. Frontend reference

### 5.1 Routes (App Router)

```
/                              → redirects: !user → /login · !onboarded → /onboarding/welcome · else /home
/login · /signup
/onboarding/welcome → languages → posters → mood → platforms → people → origin → ready

/home                          Hero card stack + BrowseGrid + activity feed + twins sidebar
/discover                      Inline Taste Engine + 7 sectioned rails
/slates                        Library with My/Saved/Trending tabs
/slates/[id]                   Detail with Slate Room (chat)
/slates/new                    Create wizard
/community                     Hot Takes + Polls + Festival banner
/notifications                 Grouped by kind
/search                        Tabbed Films / People / Slates
/settings + /settings/import   Account, prefs, Letterboxd import
/profile                       Own profile (Watchlist / Watched / Ratings tabs)
/profile/[username]            Other user — twin badge + films-youd-both-love + mutual twins
/film/[slug]                   Detail: poster + rate/shelf/watched + Connector + Cultural Context + Now Showing + Discuss + Reviews
/artists/[tmdbId]              Verified profile: banner + Filmography (chronological/best toggle) + Posts + AMAs + About
/releases                      60-day calendar grouped by date
/festivals/[slug]              Live festival timeline
/parties/[id]                  Watch party room
/circles + /circles/[id]       Private chat groups
/chapters + /chapters/[slug]   City communities
/activity · /tribe             Legacy social pages
```

### 5.2 Components by directory

```
components/ui/        Pill, CardStack (fan/mosaic/spiral), AmbientBackdrop, RankedOverlay,
                      ColorChipLegend, Button, Modal, Skeleton
components/layout/    TopNav (desktop horizontal, Letterboxd-style)
components/feed/      HeroFan, BrowseGrid, MovieSearchBar (with PEOPLE section),
                      FeedScopeTabs, SessionMoodPrompt
components/onboarding/ OnboardingProgress, StepShell, NextButton, MoodSlider
components/taste-engine/ SentenceBuilder (pill grammar), BubbleConstellation (force-collide
                      scatter, no d3 dep), SwapSheet
components/discover/  Section, RankedRow, PlatformTile, AwardTile, ArtistCircle, TwinRail
components/slates/    SlateCard, SlateFilmRow, SlateRoom, NewSlateWizard, CollaboratorAvatars
components/discourse/ HotTakeComposer, HotTakeCard, PollCard, FilmDiscussSection
components/cultural/  ConnectorRail, CulturalContextCard
components/notifications/ NotificationItem
components/social/    ActivityFeed, FollowButton, TwinBadge, CriticBadge
components/film/      FilmCard, ToneChips
components/taste/     TasteIdentityCard, TasteDriftBanner, TribeLabel
components/theatres/  NowShowingSection
components/calibration/ AccuracyRating, PairwisePicker
components/micro-feedback/ MicroFeedbackBar
```

### 5.3 State stores (Zustand)

- `authStore` — current user, login/logout/refresh
- `onboardingStore` — 8-step wizard state with submitters per step
- `feedStore` — session mood + drift banner state
- `socialStore` — micro-feedback dispatch, follow toggles
- `slateStore` — new-slate wizard draft

### 5.4 Design system

Tokens live in `globals.css` + mirrored in `lib/design-tokens.ts`.

**Surfaces**
- `--bg-screening` `#0A0A0B` — page bg
- `--bg-card` `#111114` — surface
- `--bg-elevated` `#1A1A1F` — raised

**Text** — `--text-primary` `#FAFAF7` · `--text-muted` · `--text-faint`

**Pill colour grammar (the silent taxonomy)**
| Slot | Colour |
|---|---|
| `mood` | amber `#E0A050` |
| `genre` | green `#5CA572` |
| `language` | tan `#B8956A` |
| `platform` | purple `#8B6FB5` |
| `era` | violet `#6E5BA8` |

**Action** — `--cta-primary` green · `--nav-active` coral

**Type** — Geist Sans variable for display (h1/h2/h3 + `.display`); Inter for body.

**Signature surfaces**
- `CardStack` (fan/mosaic/spiral) for hero + slate covers + ready screen
- `AmbientBackdrop` extracts dominant colour from poster via `lib/poster-color.ts` (canvas downscale, no dep)
- `BubbleConstellation` — iterative force-collide scatter (no d3-force needed)
- `RankedOverlay` — outlined editorial numerals on Trending posters

---

## 6. Page-by-page detail

### 6.1 Onboarding (8 steps)

| # | Route | What it captures | Persists to |
|---|---|---|---|
| 1 | `/welcome` | — | `onboarding_signals.welcomed_at` |
| 2 | `/languages` | Multi-select language cards (≥1) | `language_selections` |
| 3 | `/posters` | Tap 15–20 posters, no titles. ≥3 picks | `onboarding_signals.poster_picks` |
| 4 | `/mood` | 3 sliders: pacing / tone / realism | `onboarding_signals.mood_*` |
| 5 | `/platforms` | Toggle Netflix/Prime/MUBI/etc + theatre | `onboarding_signals.platforms` |
| 6 | `/people` | Pick ≥1 director/actor (TMDB search) | `favorite_people` |
| 7 | `/origin` | Optional first-film-that-mattered | `onboarding_signals.origin_film_tmdb_id` |
| 8 | `/ready` | Reveal: "We found you N films, M twins watching" | sets `user.onboarded=True` via /movies endpoint |

Backed by `OnboardingProgress` (8 dots) + `StepShell` + `NextButton` shared primitives.

### 6.2 `/home` (the main feed)

```
┌── MovieSearchBar (always visible at top, dropdown shows FILMS + PEOPLE)
│
├── TasteDriftBanner (when system detects taste shift)
├── SessionMoodPrompt ("What are you in the mood for?")
│
├── HeroFan ──── 1 hero + 3 stack-behind, ambient backdrop bleeds dominant colour
│   └─ Source: /api/feed/hero — runs full ML pipeline
│
├── BrowseGrid ── "Browse all films" — Trending/Popular/Top Rated × Tamil/Global
│   └─ Source: /api/movies/{trending|popular|top-rated}?language=
│
├── FeedScopeTabs (All/Network/Artists/World)
└── ActivityFeed ── /api/activity/feed?scope=

Sidebar (desktop only):
  ├── Your Twins Right Now — /api/feed/twins-now
  └── Trending in your city (placeholder until geo)
```

### 6.3 `/discover` (the Taste Engine + sections)

```
┌── SentenceBuilder + BubbleConstellation
│   "Show me [mood] [genre] films in [language] on [platform] from [era]"
│   • match-count updates on every pill change (debounced 250ms)
│   • Show me → 30-film force-collide scatter, sized by relevance
│   • Sparse-cache aware: if local DB has <20 matches, hydrates from TMDB
│
├── Section: Trending Now (RankedRow with editorial 1-2-3 overlay)
├── Section: Slates Worth Saving (horizontal rail)
├── Section: Browse by Platform (coloured tiles with personalised count)
├── Section: Artists on Your Radar (circles, links to /artists/[tmdbId])
├── Section: Awards (Oscars 2025 etc.)
├── Section: Your Twins Right Now (TwinRail)
├── Section: Hidden Gems (loved by your twins, under-rated globally)
└── Section: From Your Twins' Shelves (slates by 0.7+ twins)
```

### 6.4 `/film/[slug]`

```
Backdrop hero (TMDB w780)
├── Title · director · year · runtime · rating
├── Genre pills (green, taxonomy)
├── Star rating widget (1–5, 0 = clear)
├── Watchlist + Mark Watched buttons
├── Micro-Feedback (Not in mood / Too slow / Seen similar / More like this)
├── Cultural Context Card (collapsible, when seeded)
├── Connector Rail ("via the cinematographer also shot Y")
├── Now Showing (city-filtered theatre listings, when data exists)
├── Discuss (Hot Takes scoped to film + Polls)
└── Reviews (Helpful + Agree/Disagree per review)
```

### 6.5 `/slates`

Library with My/Saved/Trending tabs. Each card: 4-poster mosaic cover · title · curator · film count · save count.

`/slates/[id]`: title + description + film list with curator notes per film. Mobile: "Discuss this Slate" → bottom-sheet **Slate Room**. Desktop: room renders side-by-side. Room polls every 30s.

`/slates/new`: title + description + visibility (public/unlisted/private) → redirects to detail page where you add films.

### 6.6 `/community`

Festival banner (when one is live) → HotTakeComposer (280-char) → World/Network tab → Polls section → Hot Takes feed.

Each Hot Take card has Like / Agree / Disagree counters with toggle-on-second-click.

### 6.7 `/artists/[tmdbId]`

Cinematic banner (taken from artist's most popular film backdrop).
- Headshot · name · roles · verified badge (gold ✓)
- Tabs: **Filmography** (Chronological / Best→Worst toggle) · **Posts** (artist-only) · **AMAs** (Q&A threads) · **About**

### 6.8 `/profile/[username]` (other users)

- Twin badge with % match (from `users/{username}/twin-score`)
- Critic badge if applicable
- Stats grid (Ratings / Watched / Watchlist / Followers / Following)
- "Films you'd both love" rail (from `films-youd-both-love`)
- Mutual twins (shared followees)

### 6.9 `/profile` (own)

Watchlist / Watched / Ratings tabs. Each pulls `/api/users/me/{tab}`.

### 6.10 `/settings`

Sections: Account · Taste profile (re-run onboarding · Letterboxd import) · Notifications (per-kind opt-out) · Privacy (visibility · twin matching toggle) · Appearance (dark only + colour legend) · About.

### 6.11 `/notifications`

Grouped by kind: Twins · Social (follows / review-helpful / slate-saves / slate-messages) · Releases · Artists. Unread badge in TopNav bell.

### 6.12 `/search`

Tabbed Films / People / Slates. Auto-switches to People when query starts with `@`. Films use TMDB; People use `/api/users/search`; Slates client-filters featured.

### 6.13 `/parties/[id]`, `/circles/[id]`, `/chapters/[slug]`, `/festivals/[slug]`, `/releases`

Standard pages for the Phase 4 community + Phase 3 release/festival features. All polling-based for now (WebSockets land later for true real-time).

---

## 7. Personalisation summary

**Where onboarding actually shows up:**

| Surface | Personalised? | How |
|---|---|---|
| Home **HeroFan** | ✓✓✓ Heavy | Full pipeline + hydration |
| Home **BrowseGrid** | ✓ Light | Tamil/Global toggle uses your primary lang |
| Home **Activity feed** | ✗ Pure social | Events from people you follow |
| Discover **Trending Now** | ✓ Light | Filtered by your languages, hydrated on demand |
| Discover **Taste Engine** | ✓ Direct | Your sentence is the query |
| Discover **Artists Radar** | ✓ Direct | Your `FavoritePerson` rows |
| Discover **By Platform** | ✗ Stub | Placeholder math, real Watchmode ingest deferred |
| Discover **Hidden Gems** | ✓ Light | Films multiple users locally rated 4+ but TMDB <500 votes |
| Discover **Twins Right Now** | Approx | "Anyone watching in last 90min" — true twin intersection in P3 |
| Discover **Slates from twins** | ✗ Stub | Public slates by other users; real twin filter in P3 |
| `/notifications` | ✓ Direct | Yours only |
| Slate Rooms | ✓ Direct | Members only |

**The signal flow** (verified by `/api/recommendations/debug`):

```
LanguageSelection (rows)              FavoritePerson (rows)
       ↓                                    ↓
       ↓     OnboardingSignals (1 row)      ↓
       ↓     • mood_pacing ∈ [-1, 1]        ↓
       ↓     • mood_tone                    ↓
       ↓     • mood_realism                 ↓
       ↓     • poster_picks: int[]          ↓
       ↓     • origin_film_tmdb_id          ↓
       ↓     • platforms: str[]             ↓
       └──────────────┬─────────────────────┘
                      ▼
              load_user_priors()
                      ▼
       seed_prior_vector() → 25-dim L2-normalized vec
                      ▼
       hydrate_catalog_for_languages() → fills Movie cache
                      ▼
              pipeline.run(user_priors=...)
                      ▼
       Stages 1-4 (filter by language, rank by mood + lang_match,
       contextualise with persistent_mood)
                      ▼
       /api/feed/hero · /api/recommendations/for-you · /api/discover/trending
```

---

## 8. Diagnostic endpoint

When in doubt, hit `GET /api/recommendations/debug` (logged in). Returns:
- Your raw onboarding signals
- The computed seed prior (norm + non-zero check)
- Interaction counts (drives prior_weight blend)
- Per-language film count in the local cache
- Plain-English diagnostics: e.g. *"Only 0 films cached in 'ta'. The hydrator should top this up on the next /for-you call."*

---

## 9. What's a stub vs production-ready

**Production-ready**
- Auth + onboarding + film actions (rate/watchlist/watched)
- Recommendation pipeline + catalog hydration
- Taste Engine sentence builder + bubble constellation + TMDB augment
- Slates CRUD + Slate Rooms (30s polling)
- Hot Takes + Polls + Review Agree/Disagree
- User search + twin score + films-youd-both-love
- Notifications + dispatch from key events
- Artist profiles + filmography + AMAs
- Settings (preferences + Letterboxd import)
- Cultural Connector + Hidden Gems
- All 14 Alembic migrations exist (currently dev mode auto-creates)

**Stubbed / placeholders (data layer ready, ingest pending)**
- Streaming providers per film (Watchmode integration not wired)
- Theatre showtimes (no partner feed yet)
- Festival schedules (no source feed)
- Cultural context cards (table exists, content needs LLM seeding)
- Verified artist claims (manual DB toggle today)
- Platform tile counts on Discover (placeholder math)

**Approximate / V1**
- "Twin" framing uses Jaccard + follow-graph mutuals; true Neo4j taste graph in P3+
- Watch parties use polling (5s playback / 3s reactions); WebSockets in P4
- Hero-feed `surface` slots are computed but Home only shows the 1 hero — swipe stack and "might surprise you" UI not yet built

**Known dev-mode caveat**
Schema is auto-created on uvicorn startup via `Base.metadata.create_all()`. Before production, run `alembic stamp head` once against the live DB and remove the `create_all()` call from `main.py`.

---

## 10. Repo layout

```
SlateClub/
├── backend/
│   ├── app/
│   │   ├── core/        config, auth, database, neo4j_client
│   │   ├── data/        poster_gut_test_seed.json (curated 35 films)
│   │   ├── integrations/ tmdb.py
│   │   ├── ml/
│   │   │   ├── embeddings/  taste_vector.py
│   │   │   ├── models/      als, content_based, two_tower, xgboost_ranker
│   │   │   ├── pipeline/    recommendation_pipeline.py
│   │   │   ├── graph/       taste_graph, community, graph_recommend (Neo4j)
│   │   │   └── llm/         taste_describer, taste_identity, drift_detector, contextual_bandit
│   │   ├── models/      18 SQLAlchemy modules
│   │   ├── routes/      27 routers (177 endpoints)
│   │   ├── services/    notify.py
│   │   └── main.py
│   ├── alembic/versions/  14 migrations
│   ├── requirements.txt
│   └── .env             DATABASE_URL · TMDB_API_KEY · JWT_SECRET · ANTHROPIC_API_KEY · NEO4J_*
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/    login, signup
│   │   │   ├── (main)/    home, discover, slates, community, profile, film, artists, etc.
│   │   │   ├── onboarding/ welcome → ready (8 steps)
│   │   │   ├── globals.css   design tokens
│   │   │   └── layout.tsx    root layout (auth bootstrap)
│   │   ├── components/     ~50 components by domain
│   │   ├── lib/            api.ts, design-tokens.ts, poster-color.ts, nav.ts
│   │   ├── stores/         Zustand stores
│   │   └── types/          shared TS types
│   ├── next.config.ts      images.tmdb.org whitelisted
│   └── package.json
│
├── vision.md              Original product brief
├── ARCHITECTURE.md        Original architecture brief
└── slateclubv1.md         ← this file
```

---

## 11. Where to look when something feels off

| Symptom | Look at |
|---|---|
| Recs show only English | `/api/recommendations/debug` → check `userLanguageCounts` |
| Hero card doesn't change | `feed.py:hero_feed` console logs `[hero] hydrated …` |
| Discover "Show me" button silent | `taste_engine.py:_augment_from_tmdb` console logs |
| Pillscreen ugly | `globals.css` tokens or `Pill.tsx` `kind` prop |
| Search returns no users | `/api/users/search` – ILIKE match on name/username |
| Notification didn't fire | Check `services/notify.py` is imported at the event site |
| Onboarding skipped step 4 | `onboardingStore.ts` `currentStep` typing |
| TMDB images broken | `next.config.ts` `images.remotePatterns` |
| Backend won't start | `python-multipart` installed? Postgres running? `slateclub` DB exists? |

---

*Last updated: April 2026 · 177 backend routes · ~50 frontend pages/components · 14 Alembic migrations · Type-checks clean.*
