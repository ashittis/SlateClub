# SlateClub — Complete Reference

> The single "everything" document: what the product is, every page, every component, every
> API endpoint, every table, and how the taste engine works.
>
> Companion docs: [vision.md](vision.md) (product vision + screen-by-screen UX intent) ·
> [ARCHITECTURE.md](ARCHITECTURE.md) (deep system design, signal math, phased build) ·
> [CLAUDE.md](CLAUDE.md) (working rules for contributors).
>
> Branch at time of writing: `D-0.4.0-vertical-slices` · 69 tables · 30 migrations ·
> ~240 API endpoints · 48 frontend routes.

---

## Table of contents

1. [What SlateClub is](#1-what-slateclub-is)
2. [Stack](#2-stack)
3. [Repository layout](#3-repository-layout)
4. [Running it](#4-running-it)
5. [Design system](#5-design-system)
6. [App shell & navigation](#6-app-shell--navigation)
7. [Every page](#7-every-page)
8. [Frontend component library](#8-frontend-component-library)
9. [Frontend lib, stores & types](#9-frontend-lib-stores--types)
10. [Backend architecture](#10-backend-architecture)
11. [Feature slices](#11-feature-slices)
12. [Full API reference](#12-full-api-reference)
13. [Data model — all 69 tables](#13-data-model--all-69-tables)
14. [Migrations](#14-migrations)
15. [The ML / taste engine](#15-the-ml--taste-engine)
16. [Shared services](#16-shared-services)
17. [Integrations & external data](#17-integrations--external-data)
18. [The Community Intelligence Engine](#18-the-community-intelligence-engine)
19. [Scripts & offline jobs](#19-scripts--offline-jobs)
20. [Conventions](#20-conventions)
21. [Status & roadmap](#21-status--roadmap)

---

## 1. What SlateClub is

**"Spotify × Letterboxd for movies."** A unified cinema platform for discovering, tracking,
reviewing, and discussing films and series.

The differentiator is a **mood-aware taste engine**: it recommends by *tone, pacing, and
storytelling style* rather than genre. "Slow-burn character study with warm cinematography"
is a first-class query; "Drama, 2019" is not the point.

Three product pillars:

| Pillar | What it means in the app |
|---|---|
| **Taste** | A 25-dim taste vector per user, built from onboarding seeds + ratings + watches + micro-feedback. Powers For You, "movies like ___", taste twins, tribes, and Match Cut. |
| **Library** | Rate (quarter-star), diary, watchlist ("shelf"), currently-watching with progress, DNF with a reason, reviews, season/episode ratings, Wrapped. |
| **Community** | Posts, hot takes, polls, taste circles, city chapters, festival hubs, DMs & film-DMs, watch parties, slates (collaborative playlists), artist AMAs. |

Everything is **cards-first** and **poster-as-album-art**, on a cinema-dark palette, with
motion treated as part of the product rather than decoration.

---

## 2. Stack

| Layer | Tech |
|---|---|
| **Frontend** | Next.js 16.2.3 (App Router, Turbopack) · React 19.2.4 · TypeScript 5 · Tailwind v4 · Framer Motion 12 · GSAP 3.15 (+ `@gsap/react`) · Zustand 5 · TanStack Query 5 · Three.js 0.184 · Geist |
| **Backend** | Python 3.12 · FastAPI 0.115 · async SQLAlchemy 2.0 · asyncpg · Alembic 1.15 · Pydantic Settings · python-jose (JWT) · passlib/bcrypt · httpx |
| **Database** | PostgreSQL 17 — **port 5433**, database `slateclub` |
| **ML** | NumPy · scikit-learn · SciPy · XGBoost 3 (4-stage pipeline) |
| **Graph** | Neo4j 5 · networkx · python-louvain *(optional — degrades gracefully)* |
| **Cache** | Redis 5–6, DB index **1** *(optional — degrades to in-process compute)* |
| **LLM** | OpenAI (`gpt-5.5`, `text-embedding-3-large`) · Anthropic SDK |
| **External** | TMDB (catalog/posters/search) · Reddit API (offline enrichment) · Brave Search API (community consensus) |

Frontend `dev` script passes `--max-old-space-size=8192` so Turbopack doesn't OOM on first
compile.

---

## 3. Repository layout

```
SlateClub/
├── CLAUDE.md              working rules (read before any task)
├── vision.md              product vision + screen-by-screen UX flow
├── ARCHITECTURE.md        system design, signal math, 5-phase build
├── SLATECLUB.md           ← this document
│
├── backend/
│   ├── app/
│   │   ├── main.py             FastAPI app: CORS, startup create_all, router registration
│   │   ├── models_registry.py  imports every model module so Base.metadata is complete
│   │   ├── routes/__init__.py  the router registry → all_routers
│   │   ├── core/               auth (JWT), config, database, redis, neo4j
│   │   ├── integrations/       tmdb.py, reddit.py, websearch.py
│   │   ├── ml/                 the recommendation engine
│   │   ├── shared/
│   │   │   ├── models/         heavily-shared tables (user, movie, actions, social, …)
│   │   │   └── services/       cross-cutting logic (notify, taste_cache, watch_signals, …)
│   │   ├── features/           17 vertical slices
│   │   └── data/               poster_gut_test_seed.json
│   ├── alembic/versions/       0001 … 0030
│   ├── scripts/                training, seeding, enrichment, warming
│   ├── docs/                   recommendation-improvements.md
│   └── bootstrap_db.py         one-time create_all bootstrap
│
├── frontend/
│   └── src/
│       ├── app/                routes (folder path = URL)
│       │   ├── (auth)/         login, signup
│       │   ├── (main)/         the signed-in app
│       │   └── onboarding/     the 7-step first-run flow
│       ├── components/         24 feature folders, each with a README
│       ├── lib/                api client, tokens, nav, formatters
│       ├── stores/             Zustand: auth, feed, onboarding, social
│       └── types/              shared TS interfaces
│
├── files/                 reference docs, planning notes, assets
│   ├── docs/              Recommendation.md, RECS_TRAINING_PLAN.md, FEATURES.md,
│   │                      slateclubv1.md, About.md
│   ├── planning/          gptplan.md, DNF.md, essence.md, Next_step.md, Blend.md
│   └── assets/            typologo, icon, recommendation-and-discovery-engine.html
│
└── figma-screens/         PNG design references (home, taste-engine, discovery)
```

**Every folder has a `README.md`** explaining its job in plain terms. That rule is enforced
in `CLAUDE.md` — when you add or meaningfully change a folder, update its README.

---

## 4. Running it

**Backend** (port 8000):
```cmd
cd backend
.venv\Scripts\activate.bat          :: PowerShell: .venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

**Frontend** (port 3000):
```cmd
cd frontend
npm run dev
```

| Surface | URL |
|---|---|
| App | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health | http://localhost:8000/api/health |

`GET /api/health` returns `{status, phase, stack, services:{neo4j: "up"|"down"}}` — Neo4j is
reported but never required.

### Environment

`backend/.env` (loaded via `pydantic-settings`; see `app/core/config.py`):

| Key | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://…@localhost:5432/slateclub` | **set to port 5433** locally |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | dev placeholders | change for prod |
| `JWT_ACCESS_EXPIRE_MINUTES` | `15` | |
| `JWT_REFRESH_EXPIRE_DAYS` | `7` | |
| `TMDB_API_KEY` / `TMDB_BASE_URL` | set / `api.themoviedb.org/3` | catalog source of truth |
| `FRONTEND_URL` | `http://localhost:3000` | comma-separated list → CORS allowlist |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | bolt://localhost:7687 | optional |
| `REDIS_URL` | `redis://localhost:6379/**1**` | DB 1 isolates SlateClub from other projects |
| `OPENAI_API_KEY` / `OPENAI_LLM_MODEL` / `OPENAI_EMBED_MODEL` | `` / `gpt-5.5` / `text-embedding-3-large` | |
| `ANTHROPIC_API_KEY` | `` | optional tone-tag extraction |
| `REDDIT_CLIENT_ID` / `_SECRET` / `_USER_AGENT` | `` | **offline enrichment only, never the request path** |
| `BRAVE_SEARCH_API_KEY` | `` | web source for the Community Intelligence Engine; warmer-only |

`frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000`.

Every optional service is gated by an `is_available()` / `*_available()` check so the app
runs fully without Redis, Neo4j, Reddit, Brave, or an LLM key — those features just degrade.

### Schema bootstrap (one-time, already done)

Migration `0001_onboarding_signals` assumes base tables exist, so the order was:

1. `python bootstrap_db.py` — `Base.metadata.create_all` builds the base schema from models.
2. `alembic stamp head` — mark migrations applied without re-running.

Ongoing: `alembic revision -m "..."` → `alembic upgrade head`. `main.py` also runs
`create_all` on startup, so *model-only* additions appear automatically in dev — but use
Alembic for anything needing a data migration or a careful column change.

---

## 5. Design system

### Palette (`globals.css` + TS mirror in `lib/design-tokens.ts`)

**Surfaces** — `--bg-screening #0A0A0B` · `--bg-card #111114` · `--bg-elevated #1A1A1F` ·
`--bg-overlay rgba(10,10,11,.72)`

**Text** — `--text-primary #FAFAF7` · `--text-muted #9A9AA0` · `--text-faint #6A6A70`

**Action / nav** — `--cta-primary #FF7A00` · hover `#FF9800` ·
`--cta-gradient linear-gradient(95deg,#FF4D00,#FF9800)` ·
`--cta-glow 0 0 40px rgba(255,120,0,.28)` · `--nav-active #C4716E` (coral)

**Brand gradient** — amber `#FF9408` → rust `#CA3F16` → crimson `#95122C` → coal `#100C08`

### The pill taxonomy — the app's silent grammar

Every chip's colour tells you its category without a label:

| Category | Token | Hex |
|---|---|---|
| Mood | `--pill-mood` | `#E0A050` amber |
| Genre | `--pill-genre` | `#5CA572` green |
| Language | `--pill-language` | `#B8956A` tan |
| Platform | `--pill-platform` | `#8B6FB5` purple |
| Era | `--pill-era` | `#6E5BA8` violet |
| Neutral | `--pill-neutral` | `#3A3A42` graphite |

Active = saturated fill; idle = subtle tint + stroke. `ColorChipLegend` teaches the code once
(surfaced in Settings). Colours live in **one** place — read them from
`design-tokens.ts` when you need them in JS/SVG/canvas, never inline.

### Motion rules

- **Framer Motion** — component enter/exit, gesture, layout (`AnimatePresence`, `layoutId`,
  `Reorder`, spring physics).
- **GSAP** — choreography spanning multiple elements or needing a timeline: hero poster fan,
  onboarding reveals, the `StarRating` gradient clip, `AmbientGlow` drift, auth-page reveals
  (`gsap.matchMedia()` for responsive timelines).
- **Cheap motion first** — CSS transforms + opacity. Canvas/WebGL only where it earns it
  (`ShaderAnimation` projector flare via Three.js).
- **No stock SVG animations, no Lottie filler, no clip-art icon packs.** Icons are Lucide or
  hand-crafted to fit the cinema-dark aesthetic (e.g. the review-pen glyph).
- `prefers-reduced-motion` is honoured throughout — components snap instead of animating.

### Mobile + web parity

Every feature ships for both surfaces. Touch targets ≥ 44px. No hover-only affordances, no
mouse-only interactions. Sheets slide up from the bottom on mobile and centre as modals on
desktop (`items-end sm:items-center`). Grids collapse 5 → 3 columns. If you can't draw it on
a phone, it isn't ready.

---

## 6. App shell & navigation

### Root layout (`app/layout.tsx`)

Inter font (`--font-inter`) · `QueryClientProvider` (staleTime 30s, gcTime 30min, retry 1,
refetch on focus + reconnect) · `AuthBootstrap` (one-shot `fetchUser()` on mount) ·
`FilmGrain` overlay across the whole app.

### `(main)/layout.tsx` — the signed-in shell

| Surface | Chrome |
|---|---|
| **Desktop (≥lg)** | `LeftRail` (Spotify-style: logo, `+ Create`, primary nav, divider, library shortcuts — your Slates + Circles) · `TopNav` offset right of the rail (persistent search input + messages / notifications / avatar dropdown) · content padded `lg:pl-60 lg:pt-14` |
| **Mobile** | Bottom tab bar (blurred, 5 slots) · Create FAB above it · content padded `pb-20` |
| **Both** | `ContinueWatchingBar` — persistent bottom resume bar from `/api/users/me/watching`; toggles `[data-cw-active]` on `body` so `globals.css` reserves matching padding; collapses to nothing when idle |

### Nav structure (`lib/nav.ts` — single source of truth)

**Desktop rail (`NAV_ITEMS`)** — Home · Search · Slates · Match Cut · Community · Releases

**Mobile tabs (`MOBILE_NAV_ITEMS`, 5 slots)** — Home · Search · Slates · Community · Profile

Notes baked into the file: **Discover was absorbed into Home** (the essence answer,
theatres/OTT, and hidden gems all live on `/home` now), so `/discover` is a redirect and not
a destination. The freed mobile slot went to Search — "I know what I want" deserves a door
that isn't a poster wall. Icons come from a shared `NAV_ICONS` map keyed by href
(`components/layout/navIcons.tsx`), used by both the rail and the mobile bar.

### `+ Create` menu (`CreateMenu`)

Rail button on desktop, FAB on mobile. Options: **Slate · Collaborative Slate · Match Cut ·
AI Slate (Beta) · New Post.**

---

## 7. Every page

48 route files. Entry logic: `app/page.tsx` (`/`) reads the auth store and redirects —
not logged in → `/login`; logged in but `!user.onboarded` → `/onboarding/welcome`;
otherwise → `/home`. It renders a spinner while `loading`.

### 7.1 Auth — route group `(auth)`

`(auth)/layout.tsx` wraps both screens in the atmospheric shell: `Logo` · `AmbientGlow` ·
`FilmGrain` · `ShaderAnimation` (WebGL projector flare).

| Route | File | What it is |
|---|---|---|
| `/login` | `(auth)/login/page.tsx` | Email + password. GSAP-choreographed reveal with `gsap.matchMedia()` for responsive timelines. Calls `authStore.login()` → `POST /api/auth/login` (sets the JWT cookie). |
| `/signup` | `(auth)/signup/page.tsx` | Name, username, email, password → `authStore.signup()` → `POST /api/auth/signup`, then straight into onboarding. |

Both use `components/auth/AuthField` for consistent focus/validation styling.

### 7.2 Onboarding — 7 steps

`onboarding/layout.tsx` renders `AmbientGlow` + a header (Logo, step label,
`OnboardingProgress` dots) on every step except welcome and ready. `STEP_MAP` maps path →
step number; `TOTAL_STEPS = 7`.

| # | Route | What the user does |
|---|---|---|
| 1 | `/onboarding/welcome` | Warm intro splash. No chrome — the reveal *is* the page. |
| 2 | `/onboarding/languages` | Pick the languages you watch in → `POST /api/onboarding/languages` (writes `LanguageSelection`). |
| 3 | `/onboarding/posters` | **The Poster Gut Test** — react to a curated poster set (seeded from `app/data/poster_gut_test_seed.json`); `GET /api/onboarding/posters/set` then `POST /api/onboarding/posters`. Pure instinct, no titles-you-should-like pressure. |
| 4 | `/onboarding/mood` | Two-pole `MoodSlider`s → `POST /api/onboarding/mood`. Axes in `onboardingStore`: **pacing** (slow burn ↔ high octane), **tone** (dark/heavy ↔ light/fun), **realism** (grounded ↔ surreal). Centre = "haven't decided". |
| 5 | `/onboarding/platforms` | Which services you actually have → `POST /api/onboarding/platforms` (purple pills). |
| 6 | `/onboarding/people` | Anchor on a director/actor — live TMDB person search via `GET /api/onboarding/people/search` → `POST /api/onboarding/people`. |
| 6b | `/onboarding/origin` | Cinema origin story (optional) — favourite-films selection folded in here → `POST /api/onboarding/origin`. |
| 7 | `/onboarding/ready` | "Your taste is ready" — reads `GET /api/onboarding/summary`, big `Logo` hero, hands off to `/home`. |
| — | `/onboarding/movies` | **Legacy redirect** → `/onboarding/origin`. |

Shared step components: `StepShell` (animated title/subtitle + body slot + sticky mobile
footer), `OnboardingProgress`, `MoodSlider`, `NextButton` (disabled-until-valid, spinner +
"Saving…", amber gradient glow). State lives in `stores/onboardingStore.ts`.

Onboarding output is the **cold-start signal** the recommendation engine reads before the
user has rated anything.

### 7.3 The main app — route group `(main)`

#### Home & feeds

**`/home`** — 362 lines, the centre of gravity. Composition top to bottom:

1. `AmbientBackdrop` keyed to the hero poster (samples its dominant colour, bleeds a radial
   gradient behind the page, morphs on change).
2. `MovieSearchBar` — always-on search.
3. `JumpBackInRow` (`/api/users/me/watching`) + `ContinueSlatesRow` (`/api/slates/mine`) —
   in-progress leads for returning users; both self-hide when empty.
4. `NewUserPrompt` — cold-start card, shown until the user has rated enough films
   (`/api/users/me/ratings`).
5. `MoviesLikeSection` — **"Show me something like ___"**, the essence engine; the reason to browse.
6. `TasteDriftBanner` — only if the engine detected a taste phase transition.
7. **Two-column on desktop** (`lg:grid-cols-[minmax(0,1fr)_320px]`):
   - Main: `HeroFan` (`/api/feed/hero`, remounted per refetch so it can't wedge on a stale
     exit transform) → `FeedScopeTabs` + "Open For You →" → **From your orbit**
     (`ActivityFeed`, ratings & activity from people you follow) → `ForYouGrid` (renders
     nothing if the engine is empty) → `BrowseGrid` (always-on catalog fallback) →
     `DiscoverRows` (theatres/OTT + hidden gems, absorbed from Discover) →
     `TrendingNearYouRow` (`/api/feed/city-trending`).
   - Sidebar: **Your twins right now** (`/api/feed/twins-now`) and other modules.

**`/for-you`** — the personalised feed as a real destination. It used to be a Home section
capped at 10 with pages 2+ unreachable; now it pages through the full ranked list and honours
the session mood (`ForYouGrid` + `SessionMoodBar`). Logged-out state prompts login.

**`/activity`** — chronological friends' activity, `GET /api/activity/feed`, polled every 30s,
rendered by `ActivityFeed` (merges rated+reviewed on the same film into one card).

**`/discover`** — permanent `redirect("/home")`. Kept so old links don't 404.

#### Search

**`/search`** — 355 lines. Tabs: **All · Films · People**.
- Default (empty) state: `GenreMoodTileGrid` coloured browse tiles + recent searches +
  recently-viewed (persisted locally via `lib/searchHistory.ts`, each removable).
- `SearchFilterBar` — Type/Year chips with an `applyFilters()` helper.
- People tab → `PeopleResults` (`/api/users/search`, `UserChip` rows).
- `MoviesLikeSection` also lives here, plus `AddToSlateSheet` on results.
- `/api/search/popular-in-orbit` surfaces what your orbit is watching.

#### Film & series

**`/film/[slug]`** — 784 lines, the densest page in the app. Sections:
`AmbientBackdrop` → title/meta (language codes mapped to display names) → **Your Rating**
(`StarRating`, quarter-star) → action row (`Button`s: watchlist/shelf, watched, watching,
DNF) → **Overview** (`ExpandableSynopsis`) → **Cast** → **Quick feedback**
(`MicroFeedbackBar`) → `MoreLikeThisRow` (`/api/taste-engine/similar`) →
**`CommunityConsensus`** (the Community Intelligence panel) → `CulturalContextCard` +
`ConnectorRail` → `NowShowingSection` (city showtimes) → `FilmDiscussSection` (hot takes +
polls) → **Reviews** (`POST /api/reviews`).

Sheets available from the page: `RecommendSheet` (send a film DM), `ShelfNoteSheet` (private
note when shelving), `DNFSheet` (capture *why* you bailed), `AddToSlateSheet`, and
`LogCompletionBurst` (one-shot particle celebration on marking watched). Every mutation calls
`refreshProfileTabs()` so the profile library stays in sync.

**`/series/[slug]`** — 315 lines. Tabs: **Overview · Episodes · Reviews · Similar**. All API
calls carry `?mediaType=tv`. Status object tracks `inWatchlist / watching{progressPct} /
watched / dnf{reason} / rating`. Uses `SeasonAccordion` (lazy-loads episodes on expand),
`SeriesRatingSummary` (overall vs season-avg vs episode-avg + per-season bars), and
`SeriesReviews` (scoped by "Whole series / Season N"; no episode-level reviews).

**`/artists/[tmdbId]`** — 440 lines. Tabs: **Filmography · Posts · AMAs · About** (defaults to
filmography). Filmography from TMDB credits; posts and AMAs from the local artist tables;
follow/unfollow surfaces the artist in your feed.

#### Library & lists

**`/slates`** — grid of `SlateCard`s (fanned/mosaic/spiral poster collage covers) +
`CreateSlateModal`.
**`/slates/new`** — full-page create form → `POST /api/slates`.
**`/slates/[id]`** — 422 lines: cover collage, film list (`SlateFilmRow` with curator notes),
add/remove/reorder, like/save, and `SlateRoom` — the per-slate chat, polling
`/api/slates/:id/room` every 30s.
**`/slates/[id]/settings`** — rename/describe, visibility, and collaborator management via
`FriendMultiPicker`.

**`/profile`** (own) — `ProfileHero` (avatar, name, @handle, bio, 4-up stat row: Films / This
Year / Following / Followers, Edit + Sign out) · `TasteIdentityCard` · `TribeLabel` ·
`FavoriteFilms` (the pinned five, drag-to-reorder in edit mode) · `RecentActivityRow` ·
`ProfileTabs` (**Films · Diary · Ratings · Watchlist · Watching · DNF · Lists**, each tab
fetching its own endpoint) · `ProfileSidebar` (fanned watchlist strip + recent diary).

**`/profile/[username]`** (someone else) — 516 lines. `OrbitButton`, `TwinBadge`,
`CriticBadge`, `TasteMatchCard` (cosine match %, films you both love, films you'd argue
about, "Plan a movie night"), and tabs **Ratings · Shelf* · Watching* · DNF* · Slates**
(*visibility-gated). `MediaFilter` toggles All / Movies / Series.

**`/wrapped`** — year picker (`/api/wrapped/years`) into `WrappedStory`: a full-screen,
phone-first, tap-through story (segmented progress bars, tap-left/right or arrow keys,
shifting gradient per card). Cards: year splash, films/hours counts, habits stat grid,
top-rated, on-repeat, genre bars, director of the year, first/latest bookends, outro. Only
cards with data are included.

#### Social & community

**`/community`** — feed toggle **World / Network**, sort **Hot / New / Top**, `PostComposer` +
`PostCard` list, and a **Live now** strip of active festivals (`/api/festivals/active`).
**`/community/[id]`** — a post thread: post + replies + upvotes, `PostTypeBadge` flair.

**`/circles`** — your taste circles + inline create (`/api/circles/mine`, `POST /api/circles`).
**`/circles/[id]`** — circle detail: members (with roles), invite, leave, and the shared
message thread.

**`/chapters`** — city/interest groups, filterable by city.
**`/chapters/[slug]`** — chapter detail: description, member count, join/leave, and events.

**`/festivals/[slug]`** — festival hub: banner, dates, live badge, and the festival post feed.

**`/tribe`** — **Your Cinematic Tribe**: `/api/tribes/my-tribe`, taste neighbours, and
`graph-recommendations?limit=12` — recommendations that come from the Neo4j community you
were clustered into, plus an "Also part of" section.

**`/match-cut`** — your blends list (`/api/match-cut/cuts`) + `BlendInvite` /
`FriendMultiPicker` to start a new one.
**`/match-cut/[id]`** — the blend result: `MatchCutGrid` of films at the intersection of the
members' tastes; supports `?join=<token>` deep-link joining.

**`/messages`** — tabs **Chat** and **Film recs**: general DM conversations
(`/api/chat/conversations`) and film DMs (`/api/dms`) in one inbox.
**`/messages/[conversationId]`** — the thread view with composer.

**`/notifications`** — grouped inbox. Groups defined in-page: **Orbit** (orbit_request,
orbit_accepted) · **Messages** (film_recommend, dm_reaction, cut_invite) · **Twins**
(twin_activity, hidden_gem) · **Social** (follow, review_helpful, slate_save, slate_message) ·
**Releases** (release) · **Artists** (artist, ama). Any unclaimed kind still renders, so a new
notification type never disappears. Mark-all-read supported.

**`/parties/[id]`** — watch party room: film, host, start time, participant count, synced
playback position (`playbackSeconds` + `playbackUpdatedAt`), join/leave, and timed reactions.

#### Releases

**`/releases`** — categories **Upcoming / Biggies**, ranges **Week / Month**, built from
`/api/releases/calendar`. Renders `ReleaseCarousel` (3D CoverFlow deck — centre poster flat
and large, neighbours receding with scale + `rotateY` + depth shadow, the active backdrop
blurred behind as ambient light, drag/swipe with velocity thresholds) and `ReleaseCalendar`
(31-day pill strip; dates with releases carry a dot; active date springs into focus via
`layoutId` and reveals that day's films in a staggered grid).

#### Settings

**`/settings`** — sections: **Account · Taste profile · Notifications · Privacy**
(Public / Followers only / Private) **· Appearance · About**. Reads and writes
`/api/users/me/preferences`. Hosts `ColorChipLegend` so the pill grammar is teachable.

**`/settings/import`** — Letterboxd import: upload/paste an export, each row matched to TMDB
and written through the diary service so it behaves like a natively-logged entry
(`POST /api/import/letterboxd`).

---

## 8. Frontend component library

24 feature folders under `src/components/`, each with its own README.

### `ui/` — shared primitives and the visual grammar
| Component | What it does |
|---|---|
| `Pill` | The colour-coded chip (mood/genre/language/platform/era/neutral). Button or span. |
| `ColorChipLegend` | One-line key teaching the pill taxonomy. |
| `Button` | `primary` / `secondary` / `ghost` / `danger`, three sizes; primary carries the amber CTA gradient + glow. Forwards refs. |
| `Modal` | Centred dialog, blurred backdrop, spring pop-in, Esc-to-close, body-scroll lock, optional titled header. |
| `CardStack` | Fanned / mosaic / spiral poster collage (home hero, onboarding, slate covers) with staggered spring reveals. |
| `AmbientBackdrop` | Samples a poster's dominant colour and bleeds it as a soft radial gradient behind the page; morphs when the poster changes. |
| `AmbientGlow` | Layered "shader" lighting — radial core, masked sunset column, ribbed light, heavy vignette — slowly drifted by GSAP. Static under reduced motion. |
| `ShaderAnimation` | Live WebGL (Three.js) radial line-burst tinted crimson→rust→amber, like a projector flare. Renders `null` if WebGL is unavailable. |
| `FilmGrain` | Cheap static filmic noise (SVG `feTurbulence`, desaturated). |
| `RankedOverlay` | Big outlined editorial numeral (1, 2, 3…) over Trending posters — magazine layout, not a badge. |
| `Skeleton` · `Avatar` · `UserChip` · `FeedRow` · `ProgressBar` | Loading block · the one true circular avatar · avatar+name row · titled horizontal-scroll rail · thin "% watched" bar. |

### `feed/` — the home feed
`FeedScopeTabs` · `HeroFan` (GSAP/Framer poster fan) · `ForYouGrid` · `BrowseGrid` ·
`SessionMoodBar` · `MovieSearchBar` · `NewUserPrompt` · `rows/` (`JumpBackInRow`,
`ContinueSlatesRow`, `TrendingNearYouRow` — each a self-hiding `FeedRow`).

### `discover/` — find-something-to-watch surfaces
`DiscoverRows` · `RankedRow` · `MoviesLikeSection` · `SimilarAnswer` ·
**`CommunityConsensus`** · `MovieFilterModal` · `GenreMoodTileGrid` · `SearchFilterBar` ·
`PeopleResults`.

### `film/` — the film card and its sheets
`FilmCard` (the app's core unit) · `ToneChips` · `LogCompletionBurst` · `DNFSheet` ·
`RecommendSheet` · `ShelfNoteSheet` · `ProgressPosterCard` (% watched overlay) ·
`MixCollageCard` (2×2 collage "Mix") · `SplitPosterCard` (diagonal half-posters for Match
Cut) · `ExpandableSynopsis` · `MoreLikeThisRow`.

### `series/` — TV depth
`SeasonAccordion` · `EpisodeRow` · `NumericRating` (IMDb-style 1–10) ·
`EpisodeReactionPicker` (🔥 Peak, 😭 Devastating, 🤯 Mind-blowing, 💤 Slow) ·
`SeriesRatingSummary` · `SeriesReviews`.

### `ratings/`
`StarRating` — 0–5 in **quarter-star** steps; drag, tap, or arrow keys; tapping the current
value clears it. A single SVG amber→crimson gradient is revealed by a clip rect that **GSAP**
animates (fast while dragging, smooth when committed) so React never fights GSAP for the
width. `role="slider"` with `aria-valuenow`/`aria-valuetext`, four sizes (`sm`–`xl`), `xl`
keeps every star ≥44px, `touchAction: none` prevents scroll-hijack during a drag.

### `slates/`
`SlateCard` · `CreateSlateModal` · `AddToSlateSheet` · `SlateFilmRow` · `SlateRoom` (30s
polling chat) · `SlateProgressCard` · `AiSlateModal` (AI Slate Beta — "describe the vibe").

### `social/`
`ActivityFeed` (merges per person+film so rated+reviewed is one card; shelving/follows
filtered out) · `FollowButton` · `OrbitButton` (Add to Orbit → Requested → Accept → Orbiting) ·
`ReviewCard` (spoiler tag = blurred text you tap to reveal) · `ReviewForm` (500 chars) ·
`TasteMatchCard` (≥70% gets an amber glow) · `TwinBadge` · `CriticBadge` (only renders if the
user currently clears the algorithmic critic threshold).

### `taste/` & `taste-engine/`
`TasteIdentityCard` (genre-blend headline, animated axis strength bars, written taste
statement, director affinities, tribe pills — `/api/taste/identity`) · `TribeLabel` (green
pill, self-hides when tribeless) · `TasteDriftBanner` (re-checks every 5 min, expands via
`AnimatePresence` height) · `MoviesLikeBuilder` (conversational seed picker; ~250ms debounce,
searches films **and** series interleaved best-rated-first, picked title becomes an amber
poster chip).

### Remaining folders
| Folder | Components |
|---|---|
| `auth/` | `AuthField` |
| `brand/` | `Logo` — the circular "SLATECLUB · SLATECLUB" badge with two coral sparkles; inline SVG so ring text inherits `currentColor`. Mirrored at `public/logo-badge.svg` and `app/icon.svg` — keep all three in sync. |
| `calibration/` | `PairwisePicker`, `AccuracyRating` |
| `community/` | `PostCard`, `PostComposer`, `PostTypeBadge` (post/question/discussion/review/fan theory/news) |
| `cultural/` | `CulturalContextCard`, `ConnectorRail` |
| `discourse/` | `FilmDiscussSection`, `HotTakeCard`, `HotTakeComposer`, `PollCard` |
| `layout/` | `LeftRail`, `TopNav`, `CreateMenu`, `ContinueWatchingBar`, `navIcons` |
| `match-cut/` | `BlendInvite`, `FriendMultiPicker`, `MatchCutGrid` |
| `micro-feedback/` | `MicroFeedbackBar` — one-tap, optimistic; tunes recs immediately |
| `notifications/` | `NotificationItem` |
| `onboarding/` | `StepShell`, `OnboardingProgress`, `MoodSlider`, `NextButton` |
| `profile/` | `ProfileHero`, `EditProfileModal`, `FavoriteFilms`, `ProfileTabs`, `filmDisplays`, `MediaFilter`, `ProfileSidebar`, `RecentActivityRow` |
| `releases/` | `ReleaseCarousel`, `ReleaseCalendar`, `types.ts` |
| `theatres/` | `NowShowingSection` — self-hiding; groups showtimes per theatre, time chips deep-link to the partner booking URL |
| `wrapped/` | `WrappedStory` |

---

## 9. Frontend lib, stores & types

### `lib/`
| File | Purpose |
|---|---|
| `api.ts` | Fetch wrapper for FastAPI — base URL from `NEXT_PUBLIC_API_URL`, cookie credentials, typed helpers. Used with TanStack Query. |
| `constants.ts` | App-wide constants. |
| `design-tokens.ts` | TS mirror of the CSS tokens (surface, text, pill, cta, gradient, nav) + `pillColor()`. **One source of truth** for JS/SVG/canvas colour. |
| `nav.ts` | `NAV_ITEMS`, `MOBILE_NAV_ITEMS`, `NavItem`, `NavIconRenderer`. |
| `poster-color.ts` | Derives an accent colour from a poster for ambient backdrops. |
| `profileFormat.ts` | Profile stat/label formatting. |
| `searchHistory.ts` | Local recent-search + recently-viewed persistence. |
| `shelfReasons.ts` | Reason labels for "why this is on your shelf". |
| `titleHref.ts` | Builds the right route for a film vs a series. |

### `stores/` (Zustand)
| Store | State |
|---|---|
| `authStore` | `user`, `loading`, `login`, `signup`, `logout`, `fetchUser`. |
| `feedStore` | `sessionMood` + `sessionMoodExpiry` (**2-hour TTL**), `setSessionMood`, `clearExpiredMood`. |
| `onboardingStore` | `OnboardingStep 1..8`, `selectedLanguages`, `selectedPeople`, `selectedMovies`, `posterPicks`, mood sliders (`pacing`, `tone`, `realism`, each −1…+1). |
| `socialStore` | `followUser`/`unfollowUser`, `submitReview`, `markHelpful`, `submitMicroFeedback`, `submitCalibration`. |

### `types/`
`discourse.ts` · `movie.ts` · `notifications.ts` · `onboarding.ts` · `posts.ts` · `series.ts` ·
`slates.ts` · `social.ts` · `user.ts`

---

## 10. Backend architecture

The FastAPI backend is organised as **vertical feature slices**. Each user-facing feature
lives in `app/features/<slice>/` holding its routes plus the models and services only it
owns. Anything shared by many features lives in `shared/`, `core/`, `ml/`, or `integrations/`.

### Request flow

1. `main.py` builds the app (CORS from `FRONTEND_URL`, `lifespan` runs
   `Base.metadata.create_all` on startup and disposes the engine + Redis on shutdown) and
   includes every router from `routes/__init__.py`.
2. The route lives in a feature slice, e.g. `features/discovery/discover.py`.
3. It depends on `core.auth.get_current_user` + `core.database.get_db`, reads/writes models
   (feature-owned or shared), and calls `shared/services` or `ml/` for anything beyond CRUD.
4. Responses are Pydantic-serialised movie/user payloads.

### `core/` — infrastructure only, no product logic
| File | Role |
|---|---|
| `config.py` | `settings` from `.env` (pydantic-settings). |
| `database.py` | Async SQLAlchemy 2.0 `engine`, `Base`, and the `get_db` dependency yielding an `AsyncSession` per request. |
| `auth.py` | Password hashing, JWT create/verify, and `get_current_user` — the dependency every protected route uses. |
| `redis_client.py` | Redis connection for `taste_cache`; degrades gracefully when down. |
| `neo4j_client.py` | Optional Neo4j driver; `neo4j_available()` lets features fall back cleanly. |

### Why some things are shared, not sliced

`user`, `movie`, `actions`, `social`, and `onboarding` are imported by **8–41 files each** —
they are the connective tissue of the product. Splitting them into slices would force every
feature to cross-import, so they live in `shared/models/`. Same reasoning for `notify`,
`taste_cache`, `watch_signals`, and `diary_service` in `shared/services/`.

Two functions deserve a note: **`_get_or_fetch_movie(...)`** and **`_upsert_movie(...)`** live
in `features/movies/movies.py` but are effectively a shared movie service — series, dms,
slates, users, recommendations, and several services import them. They are the single source
of truth for "get me a movie row".

---

## 11. Feature slices

| Slice | What it is | Route files |
|---|---|---|
| `auth` | Signup / login / JWT sessions | `routes.py` |
| `users` | Profiles + the follow/orbit social graph | `users.py`, `follows.py`, `orbits.py` |
| `movies` | Film & series detail (+ the shared movie-fetch helpers) | `movies.py`, `series.py` |
| `ratings` | Rate / watchlist / diary / reviews / DNF / wrapped / critics / feedback | `ratings.py`, `watchlist.py`, `watch_history.py`, `diary.py`, `reviews.py`, `critics.py`, `feedback.py`, `wrapped.py` |
| `discovery` | Home feed, search, discovery rows, community consensus | `feed.py`, `discover.py`, `search.py`, `consensus.py` (+ `community_engine`, `community_scoring`, `community_personalize`, `community_warm`) |
| `recommendation` | The taste-engine API | `recommendations.py`, `taste.py`, `tribes.py`, `anchors.py`, `taste_engine.py` (+ `similar_films.py`, `models.py`) |
| `match_cut` | Taste-blend matching game | `routes.py`, `service.py`, `models.py` |
| `community` | Posts, hot takes, polls, circles, chapters, festivals, DMs, chat | `posts.py`, `discourse.py`, `comments.py`, `circles.py`, `chapters.py`, `festivals.py`, `dms.py`, `chat.py` |
| `onboarding` | First-run taste calibration | `routes.py` |
| `artists` | Filmmaker/actor pages, AMAs | `routes.py`, `models.py` |
| `releases` | Release calendar, cultural context, theatres | `releases.py`, `cultural.py`, `theatres.py` (+ `service.py`, `models/`) |
| `watch_parties` | Synchronised group viewings | `routes.py`, `models.py` |
| `slates` | Curated film collections | `routes.py`, `models.py` |
| `notifications` | The alert inbox (read side) | `routes.py`, `models.py` |
| `activity` | The friends' activity feed | `routes.py` |
| `imports` | Import history from external services | `routes.py` |

**Adding a feature's endpoints:** write the routes in `app/features/<slice>/`, then
`from app.features.<slice>.<module> import router as <name>_router` in
`app/routes/__init__.py` and append it to `all_routers`. `routes/` is *only* a registry — no
route logic lives there anymore.

---

## 12. Full API reference

All routers are registered in `app/routes/__init__.py` (42 routers). Every protected route
depends on `get_current_user`.

### Auth — `/api/auth`
`POST /signup` · `POST /login` · `POST /refresh` · `POST /logout` · `GET /me`

### Movies — `/api/movies`
`GET /search` · `GET /trending` · `GET /popular` · `GET /top-rated` · `GET /discover` ·
`GET /{tmdb_id}` · `GET /{tmdb_id}/status` ·
`POST|DELETE /{tmdb_id}/watchlist` · `POST|DELETE /{tmdb_id}/watched` ·
`POST|DELETE /{tmdb_id}/watching` · `POST|DELETE /{tmdb_id}/dnf` · `POST /{tmdb_id}/rate`

### Series — `/api/series`
`GET /search` · `GET /{tmdb_id}` · `GET /{tmdb_id}/season/{n}` · `GET /{tmdb_id}/my-ratings` ·
`POST /{tmdb_id}/season/{n}/rate` · `POST /{tmdb_id}/season/{n}/episode/{e}/rate` ·
`POST /{tmdb_id}/season/{n}/episode/{e}/reaction`

### Search — `/api/search`
`GET /titles` · `GET /popular-in-orbit`

### Ratings & library
| Router | Endpoints |
|---|---|
| `/api/ratings` | `POST /` · `GET /{movie_id}` · `GET /` · `DELETE /{movie_id}` |
| `/api/watchlist` | `POST /` · `GET /` · `DELETE /{movie_id}` |
| `/api/watch-history` | `POST /` · `GET /` · `GET /{movie_id}` |
| `/api/diary` | `POST ""` · `GET ""` · `PATCH /{entry_id}` · `DELETE /{entry_id}` |
| `/api/reviews` | `POST /` · `GET /movie/{movie_id}` · `POST /{review_id}/helpful` · `DELETE /{review_id}` |
| `/api/comments` | `POST /` · `GET /{review_id}` · `DELETE /{comment_id}` |
| `/api/critics` | `GET /check/{username}` · `GET /leaderboard` |
| `/api/feedback` | `POST /micro` · `GET /micro` · `POST /calibration` · `GET /calibration/status` · `GET /calibration/pair` |
| `/api/wrapped` | `GET /years` · `GET /{year}` |

### Users & social graph
| Router | Endpoints |
|---|---|
| `/api/users` | `GET /search` · `GET /{username}` · `GET /me/profile` · `GET /me/watchlist` · `GET /me/watching` · `GET /me/dnf` · `GET /me/watched` · `GET /me/ratings` · `GET /me/favorites` · `PATCH /me` · `GET|PATCH /me/preferences` · `GET /{username}/twin-score` · `GET /{username}/films-youd-both-love` · `GET /{username}/mutual-twins` · `GET /{username}/ratings` · `GET /{username}/watchlist` · `GET /{username}/watching` · `GET /{username}/dnf` |
| `/api/follows` | `POST /` · `DELETE /{user_id}` · `GET /{user_id}/followers` · `GET /{user_id}/following` · `GET /{user_id}/check` |
| `/api/orbits` | `POST /request` · `GET /requests` · `POST /requests/{id}/accept` · `POST /requests/{id}/decline` · `GET ""` · `GET /status/{user_id}` · `DELETE /{user_id}` |
| `/api/activity` | `GET /feed` · `GET /user/{user_id}` |

### Onboarding — `/api/onboarding`
`POST /languages` · `GET /people/search` · `POST /people` · `GET /movies/search` ·
`POST /movies` · `GET /status` · `GET /posters/set` · `POST /posters` · `POST /mood` ·
`POST /platforms` · `POST /origin` · `POST /welcome` · `GET /summary`

### Recommendation & taste
| Router | Endpoints |
|---|---|
| `/api/recommendations` | `GET /for-you` · `GET /session-moods` · `GET /debug` · `POST /from-anchors` |
| `/api/taste` | `GET /identity` · `GET /drift` · `POST /extract-tone/{tmdb_id}` · `GET /bandit/weights` · `GET /vector` |
| `/api/taste-engine` | `POST /similar` |
| `/api/tribes` | `GET /my-tribe` · `GET /clusters` · `GET /{cluster_id}/movies` · `GET /taste-neighbors` · `GET /graph-recommendations` · `POST /detect` |

### Discovery
| Router | Endpoints |
|---|---|
| `/api/feed` | `GET /hero` · `GET /twins-now` · `GET /city-trending` |
| `/api/discover` | `GET /trending` · `GET /artists-radar` |
| `/api/discovery` | `POST /consensus` |

### Slates — `/api/slates`
`POST ""` · `GET /mine` · `GET /saved` · `GET /collaborative` · `GET /by-user/{username}` ·
`GET /featured` · `GET /from-twins` · `GET /{slate_id}` · `PATCH /{slate_id}` ·
`DELETE /{slate_id}` · `POST /{slate_id}/films` · `DELETE /{slate_id}/films/{tmdb_id}` ·
`PATCH /{slate_id}/films/reorder` · `PATCH /{slate_id}/films/{tmdb_id}/note` ·
`POST|DELETE /{slate_id}/like` · `POST|DELETE /{slate_id}/save` ·
`POST /{slate_id}/collaborators` · `DELETE /{slate_id}/collaborators/{user_id}` ·
`GET|POST /{slate_id}/room`

### Community
| Router | Endpoints |
|---|---|
| `/api` (posts) | `POST|GET /posts` · `GET /posts/{id}` · `DELETE /posts/{id}` · `POST /posts/{id}/upvote` · `POST|GET /posts/{id}/replies` · `DELETE /posts/{id}/replies/{reply_id}` |
| `/api` (discourse) | `POST|GET /hot-takes` · `DELETE /hot-takes/{id}` · `POST /hot-takes/{id}/react` · `POST|GET /polls` · `POST /polls/{id}/vote` · `POST /reviews/{id}/vote` · `GET /reviews/{id}/votes` |
| `/api/circles` | `POST ""` · `GET /mine` · `GET /{id}` · `POST /{id}/invite` · `DELETE /{id}/leave` · `GET|POST /{id}/messages` |
| `/api/chapters` | `GET ""` · `GET /{slug}` · `POST ""` · `POST /{slug}/join` · `DELETE /{slug}/join` · `GET|POST /{slug}/events` |
| `/api/festivals` | `GET /active` · `GET /upcoming` · `GET /{slug}` · `GET|POST /{slug}/posts` |
| `/api/dms` | `POST ""` · `GET ""` · `GET /unread-count` · `POST /{id}/read` · `POST /{id}/reaction` |
| `/api/chat` | `GET /conversations` · `POST /conversations/with/{other_user_id}` · `GET|POST /conversations/{id}/messages` |
| `/api/match-cut` | `GET|POST /recommendations` · `POST /cuts` · `GET /cuts` · `GET /cuts/{id}` · `POST /cuts/{id}/join` · `POST /cuts/{id}/invite` · `DELETE /cuts/{id}` · `GET /{username}` |
| `/api/parties` | `POST ""` · `GET /{id}` · `POST /{id}/join` · `DELETE /{id}/join` · `POST /{id}/playback` · `GET /{id}/state` · `POST|GET /{id}/reactions` |

### Artists — `/api/artists`
`GET /search` · `GET /by-tmdb/{person_id}` · `POST|DELETE /{artist_id}/follow` ·
`GET|POST /{artist_id}/posts` · `GET|POST /{artist_id}/amas` ·
`POST /amas/{ama_id}/questions` · `POST /ama-questions/{id}/answer`

### Releases & place
| Router | Endpoints |
|---|---|
| `/api/releases` | `GET /calendar` · `GET /upcoming` · `GET /film/{tmdb_id}` |
| `/api/cultural` | `GET /filmography/{person_id}` · `GET /connector/{tmdb_id}` · `GET|POST /context/{tmdb_id}` · `GET /hidden-gems` |
| `/api/now-showing` | `GET /film/{tmdb_id}` · `GET /city/{city}` |

### Notifications & imports
`/api/notifications` — `GET ""` · `GET /unread-count` · `POST /{id}/read` · `POST /read-all`
`/api/import` — `POST /letterboxd`

### System
`GET /api/health`

---

## 13. Data model — all 69 tables

### `shared/models/` — the connective tissue

**`user.py`** *(imported by ~41 files)* — `users`, `user_preferences`, `user_taste_state`
(the current taste vector + drift bookkeeping).

**`actions.py`** *(~26 files)* — every way a user acts on a title:
`ratings` · `watchlist_items` · `watch_history` · `watch_log` · `currently_watching` ·
`dnf_entries` · `reviews` · `season_ratings` · `episode_ratings` · `episode_reactions` ·
`comments`.

**`movie.py`** *(~25 files)* — `movies`, the canonical film row mirrored from TMDB.

**`social.py`** *(~15 files)* — `follows` · `orbit_requests` · `activity_events` ·
`micro_feedbacks` · `impressions` · `calibration_responses`.

**`onboarding.py`** *(~8 files)* — `language_selections` · `favorite_people` ·
`favorite_movies` · `onboarding_signals`.

**Caches** — `similar_cache` (similar-films results) · `reddit_cache` (Reddit enrichment) ·
`discovery_cache` (the community consensus pool).

### Feature-owned tables

| Slice | Tables |
|---|---|
| `slates` | `slates` · `slate_films` · `slate_collaborators` · `slate_likes` · `slate_saves` · `slate_room_messages` |
| `community` | `posts` · `post_replies` · `post_upvotes` · `hot_takes` · `hot_take_reactions` · `polls` · `poll_votes` · `review_votes` · `taste_circles` · `taste_circle_members` · `taste_circle_messages` · `chapters` · `chapter_members` · `chapter_events` · `festivals` · `festival_posts` · `film_dms` · `chat_conversations` · `chat_messages` |
| `artists` | `artists` · `artist_posts` · `amas` · `ama_questions` · `artist_follows` |
| `releases` | `releases` · `cultural_contexts` · `theatres` · `showtimes` |
| `watch_parties` | `watch_parties` · `watch_party_participants` · `watch_party_reactions` |
| `match_cut` | `match_cuts` · `match_cut_members` |
| `recommendation` | `taste_presets` |
| `notifications` | `notifications` (+ the `NOTIFICATION_KINDS` constant) |

Every model module is imported by `app/models_registry.py` so `Base.metadata` is complete
before `create_all` / Alembic autogenerate. **A model not in the registry gets no table.**

---

## 14. Migrations

30 revisions in `backend/alembic/versions/`:

| # | Migration | # | Migration |
|---|---|---|---|
| 0001 | onboarding_signals | 0016 | movie_identity |
| 0002 | taste_presets | 0017 | user_taste_state |
| 0003 | slates | 0018 | impression_source |
| 0004 | discourse | 0019 | orbit_requests |
| 0005 | notifications | 0020 | match_cuts |
| 0006 | user_preferences | 0021 | film_dms |
| 0007 | artists | 0022 | similar_cache |
| 0008 | releases | 0023 | shelf_notes_watching_dnf |
| 0009 | cultural_contexts | 0024 | series_support |
| 0010 | festivals | 0025 | slate_media_and_likes |
| 0011 | theatres | 0026 | user_geo |
| 0012 | watch_parties | 0027 | watch_log |
| 0013 | taste_circles | 0028 | reddit_cache |
| 0014 | chapters | 0029 | impression_features |
| 0015 | community_posts / impressions *(two 0015 revisions)* | 0030 | discovery_cache |

Alembic's `env.py` imports `models_registry`, so new tables are picked up by autogenerate.

---

## 15. The ML / taste engine

```
app/ml/
  recommendationengine.py   top-level orchestration entry point
  embeddings/               taste vectors — the numeric representation of taste
  graph/                    Neo4j taste graph — similarity, communities, graph recs
  llm/                      describe taste, detect drift, bandit, movie identity
  models/                   ALS, content-based, two-tower, XGBoost ranker
  pipeline/                 the 4-stage pipeline
  eval/                     offline evaluation harness
```

### The 4-stage pipeline (`pipeline/recommendation_pipeline.py`)

| Stage | What happens |
|---|---|
| **1. Candidates** | Gather a broad pool from ALS + content-based + two-tower + graph + trending generators. |
| **2. Filter** | Drop already-seen, unavailable, disliked, or out-of-context films. |
| **3. Rank** | Score survivors with the XGBoost learning-to-rank model over taste + context features. |
| **4. Contextualize** | Attach human-readable reasons ("because you liked…"), apply the current session mood, and diversify so the list doesn't feel same-y. |

`features/recommendation/recommendations.py` is the only caller.

### `embeddings/taste_vector.py`

Builds and compares taste vectors. A user's actions are weighted (recent + highly-rated count
more) and combined with film tone/style features into a fixed-length vector. Cosine
similarity between vectors (user↔film or user↔user) drives ranking, "movies like X", taste
twins, and blend matching. Cached via `shared/services/taste_cache` so it isn't recomputed
per request.

### `models/`

| File | Role |
|---|---|
| `als.py` | ALS matrix factorization — collaborative-filtering candidates from the user×film matrix. Trained by `scripts/train_als.py`. |
| `content_based.py` | Content/tone-similarity candidates (film features → nearest films). |
| `two_tower.py` | Two-tower (user tower / item tower) retrieval model. |
| `xgboost_ranker.py` | The final learning-to-rank ranker. Trained by `scripts/train_xgboost.py`. |

Trained artifacts live under `ml/models/artifacts/`.

### `graph/` — the Neo4j taste graph *(optional)*

`taste_graph.py` (user↔film edges, film↔film similarity, the queries) ·
`graph_recommend.py` ("people with your taste also loved…", a candidate generator) ·
`community.py` (community detection → **taste tribes**, powering `/api/tribes`).
Everything degrades gracefully via `neo4j_available()`.

### `llm/`

| File | Role |
|---|---|
| `openai_client.py` | Shared LLM client wrapper (model config, calls, retries). |
| `movie_identity.py` | Extracts tone/pacing/storytelling tags for a film — **the mood-aware metadata the whole engine is built on**. |
| `taste_describer.py` | Turns a taste vector into human language ("slow-burn character studies with warm cinematography"). |
| `taste_identity.py` | Derives the user's higher-level taste persona. |
| `drift_detector.py` | Spots when recent taste has shifted from baseline → `TasteDriftBanner`. |
| `contextual_bandit.py` | The explore/exploit policy — safe picks vs novel ones, learning from feedback. Weights exposed at `/api/taste/bandit/weights`. |

### `eval/`

`harness.py` replays held-out user history through the pipeline and computes ranking metrics
(precision@k / NDCG). `feature_reconstruction.py` rebuilds the exact feature vectors a model
was trained on so offline eval doesn't suffer train/serve skew. Run via
`scripts/eval_recs.py`; used to gate whether a newly trained model gets promoted.

---

## 16. Shared services

| Service | What it does |
|---|---|
| `notify.py` | The notification **writer** — `create(...)` inserts a `Notification` of a given kind. Called by follows, orbits, dms, reviews, slates, match-cut. (The read side is the `notifications` slice.) |
| `taste_cache.py` | Redis-backed cache of a user's taste vector and derived data. Written on every taste-changing action, read on every recommendation, invalidated by ratings / watches / feedback. |
| `watch_signals.py` | Turns raw actions into taste updates: refreshes the taste vector, nudges the contextual bandit, updates `UserTasteState`. |
| `taste_embedding.py` | Builds the taste embedding from actions + onboarding, optionally described in words via the LLM. |
| `diary_service.py` | Shared diary/logging logic used by diary, imports, and movies. |
| `impressions.py` | Records which cards were actually shown (`Impression`) so the ranker learns shown-vs-clicked. |
| `trending.py` | Fetches trending films from TMDB and upserts them. |
| `geo.py` | Distance/nearby helpers for theatres & showtimes. |
| `reddit_enrich.py` | Fetches and caches Reddit discussion for a film (`RedditCache`). |

**The write-path trio** — `taste_cache` → `watch_signals` → `taste_embedding` — keeps a user's
taste fresh. `ml/` is the read-path that consumes it.

---

## 17. Integrations & external data

| Client | Role |
|---|---|
| `tmdb.py` | Search films/people, fetch film & credit details, posters, trending. The catalog source of truth; results are mirrored into the local `movies` table via `_upsert_movie`. |
| `reddit.py` | Fetches Reddit discussion threads. Gated by `is_available()` — degrades to TMDB-only when credentials are unset. **Offline enrichment only, never the request path.** |
| `websearch.py` | Brave Search API — film blogs, listicles, YouTube titles, `site:reddit.com` threads. Gated by `is_available()`. Warmer/off-response only. |

Features never call external APIs directly — these wrappers only know how to talk to the
outside world and return typed payloads; turning those into DB rows is the caller's job.

---

## 18. The Community Intelligence Engine

The newest subsystem (migration `0030_discovery_cache`), living in `features/discovery/`.
It answers **"what does the film community actually say to watch after this?"** — grounded in
real web mention frequency rather than a model's guess — then re-ranks that consensus through
the requesting user's Cinema DNA.

### Request path — `POST /api/discovery/consensus` (`consensus.py`)

Authed. Body: `{tmdbId, mediaType="movie", offset=0..20, personalized=true}`.

It **reads only the cached pool**. On a cold cache it schedules an off-response warm and
serves the essence engine's answer meanwhile (`source: "essence-fallback"`, `warming: true`),
so the endpoint is always fast and never hard-fails.

### Warm path — `community_engine.py` (419 lines)

1. **Gather corpus** — Reddit threads + Brave web search for the seed film.
2. **LLM title-extraction** per source.
3. **Resolve** each extracted title to TMDB.
4. **Weighted-frequency consensus scoring** (`community_scoring.py`, pure and unit-testable):
   source-authority weights, a cross-source-agreement bonus, a `matchScore` %, and a
   provenance label ("Mentioned across Reddit + 2 film blogs").
5. **LLM "why" reasoning** per recommendation.
6. **Cache** into `discovery_cache`.

It also grounds the essence engine with the same corpus.

### Personalization — `community_personalize.py`

Request-time re-rank of the shared community pool against the user's 25-dim taste vector,
plus the **"most people say X, but for you Y"** callout.

### Warming — `community_warm.py` + `scripts/warm_discovery.py`

Fire-and-forget from the request path, single-flighted per seed; `warm_seed` is awaitable for
the CLI batch warmer. **Always opens its own session — never the request's.**

### UI — `components/discover/CommunityConsensus.tsx`

The panel on the film detail page: the consensus list with a % grounded in real mention
frequency, provenance line, a **For you / Community** toggle, and the divergence callout.
Self-contained, `tmdbId`-gated, renders `null` when empty.

---

## 19. Scripts & offline jobs

`backend/scripts/`:

| Script | Purpose |
|---|---|
| `seed_catalog.py` | Seed the local `movies` catalog from TMDB. |
| `seed_demo.py` | Seed demo users/data for development. |
| `train_als.py` | Train the ALS collaborative-filtering model. |
| `train_xgboost.py` | Train the XGBoost ranker. |
| `eval_recs.py` | Run the offline evaluation harness. |
| `extract_movie_identities.py` | LLM tone/pacing/storytelling tag extraction for films. |
| `enrich_reddit.py` | Offline Reddit enrichment into `reddit_cache`. |
| `warm_discovery.py` | Batch-warm the community consensus pool. |

`backend/bootstrap_db.py` — one-time `create_all` bootstrap (see §4).

---

## 20. Conventions

**From `CLAUDE.md` — the five working rules:**

1. **UI/UX first.** Design the experience before writing the code. Code serves the experience.
2. **Mobile + web parity, device-independent.** `vision.md` separates Mobile vs Web for every
   page — match that convention.
3. **No stock SVG animations or generic graphics.** GSAP for choreography, Framer Motion for
   component transitions, CSS transforms for cheap motion, canvas/WebGL where it earns it.
4. **Spotify-style, UI-oriented app.** Cinema-dark palette, cards as the primary unit, posters
   as album art, colour-coded pills, bubble constellations over grids where mood-native.
5. **Small files, modular, production-oriented.** ~1500 lines is the absolute ceiling; aim well
   below. Split by responsibility — one schema per file, one pipeline stage per file, one
   route group per file. No god-files.

**Code conventions:**

| Area | Rule |
|---|---|
| Imports (backend) | Absolute `app.*` only — `from app.shared.models.movie import Movie`. Never relative. |
| Routes | Add to the owning `features/<slice>/`, then register in `routes/__init__.py`'s `all_routers`. |
| Models | Feature-only table → the slice; broadly-shared → `shared/models/`. **Either way, add it to `models_registry.py`.** |
| Services | Cross-cutting → `shared/services/`; feature-only → the slice. Route files stay thin. |
| Docs | Add or meaningfully change a folder → update its `README.md`. |
| Frontend pages | `app/(main)/<slug>/page.tsx`. Route groups, not directories, for shared layouts. |
| Animations | Framer Motion for enter/exit/gesture/layout; GSAP for multi-element timelines. |
| Colours | Palette tokens only. New accents need a reason — coral = action, green = positive/CTA, amber = mood, purple = platform, violet = era, tan = language. |
| Mobile | Don't add a feature without designing its mobile version too. |

---

## 21. Status & roadmap

`ARCHITECTURE.md` describes a 5-phase build. The codebase sits around **Phase 4** — taste
graph wired, 30 migrations, 69 tables, full route surface — with the **Phase 5 LLM layer**
scaffolded and the Community Intelligence Engine now live on the film page.

Treat new feature work as **additive**: extend the existing route/service/model trio inside
the owning slice rather than introducing parallel structures.

### Recent branch history

| Commit | What landed |
|---|---|
| `75b3cd1` | Community consensus discovery engine (Reddit + web harvest, scoring, personalization, warm cache, film-page panel) |
| `f4ed8b1` | D-0.4.0: restructure backend into vertical feature slices |
| `e634cf0` | D-0.3.0: HTML previews, brand assets, compiled artifacts |
| `12714ab` | D-0.3.0: onboarding overhaul, DM chat, artist pages, profile improvements, series ratings |
| `8131804` | Cross-origin auth fix (`samesite=none` in production) |

### Known shape of what's next

Drawn from the planning notes in [files/planning/](files/planning/) —
`essence.md` (the similarity/essence engine), `Blend.md` (Match Cut), `DNF.md`,
`Next_step.md`, `gptplan.md` — and `backend/docs/recommendation-improvements.md`.
