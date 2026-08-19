# KASET

**A social film diary and discovery platform.**

Kaset is where you log the films you watch, discover what to watch next, see what your friends are watching, and build a cinematic identity you can share.

> Spotify × Letterboxd × Strava — with its own identity.

---

## 1. The product in one loop

Everything in Kaset serves one loop. If a feature does not strengthen it, it is not part of V1.

```
ONBOARD → DISCOVER → WATCH → LOG → RATE → REVIEW → SHARE → FOLLOW / DM → DISCOVER AGAIN
```

A new user should understand the product immediately:

> *"I log the movies I watch. I discover movies. I see what my friends watch.
> I build my cinema identity. I share my cinema life."*

**Two objects sit at the centre:**
- **Film** — the central *content* object. Every path leads to a film page, and its primary action is **Log this film**.
- **Diary entry** — the central *personal* object. One row per *viewing*, never per film. Watching a film twice is two entries, both preserved.

---

## 2. V1 systems

These twenty systems are the entire product. Nothing else ships in V1.

| # | System | # | System |
|---|---|---|---|
| 1 | Authentication | 11 | Favourite cast / crew |
| 2 | Onboarding | 12 | Following |
| 3 | Film discovery / search | 13 | Activity |
| 4 | Film logging / diary | 14 | Direct messages |
| 5 | Ratings | 15 | Film sharing through DM |
| 6 | Reviews | 16 | Watchlists |
| 7 | Theatre visits | 17 | Blends |
| 8 | Rewatch tracking | 18 | Monthly / yearly Passport sharing |
| 9 | User profiles | 19 | Wrapped |
| 10 | Kaset Passport | 20 | Evidence-based discovery engine |

**Explicitly out of scope for V1** (removed from the SlateClub codebase during the rebase): taste tribes, taste circles, chapters, festivals, watch parties, artist AMAs, the critic system and badges, Match Cut in its old form, Community Consensus as a product surface, taste drift, contextual bandits, the Neo4j taste graph, large community discussion systems, the complex community feed, the 25-dimensional taste engine, and the ALS / two-tower / XGBoost recommendation stacks.

Series/TV is also out of V1 — Kaset is films only.

---

## 3. Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16.3.1 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 (CSS-first) · Framer Motion · Zustand · TanStack Query · GSAP |
| Backend | Python 3.12 · FastAPI · async SQLAlchemy 2.0 · asyncpg · Alembic |
| Database | PostgreSQL 17 (port **5432**, database `kaset`) |
| External | TMDB (catalog, posters, search) · Reddit (discovery evidence) · Brave Search (discovery evidence) · an LLM provider (extraction + final evaluation) |
| Optional | Redis (warm-cache layer; degrades gracefully when absent) |

No ML libraries. No graph database. No vector store. Kaset V1's intelligence comes from **external evidence**, not from a trained model.

---

## 4. Repository layout

```
backend/app/
  core/            config · database · auth (JWT in httpOnly cookies)
  integrations/    tmdb · reddit · websearch (Brave) · llm     [all external I/O lives here]
  shared/
    models/        user · movie                                 [only truly universal tables]
    services/      films (resolve/upsert/serialize) · notify
  features/        one vertical slice per system (§7)
  routes/          __init__.py — the router registry, nothing else
  models_registry.py                                            [imports every model for Base.metadata]
  alembic/versions/
  scripts/         offline jobs (seed catalog, warm discovery, enrich reddit)

frontend/src/
  app/             App Router — folders map to URLs
    (auth)/        login · signup
    onboarding/    5 steps
    (main)/        the signed-in app
  components/      one folder per feature, each with a README
  lib/             api/ (typed domain modules) · nav · design-tokens
  stores/          Zustand: auth · onboarding

files/docs/legacy/ SlateClub-era docs, retained for reference only. Not the spec.
```

Every folder carries a `README.md` explaining its job in plain terms. Keep them current — a folder's README is a deliverable of the phase that changes it.

---

## 5. Running it

**Backend** (port 8000):
```bash
cd backend
source .venv/bin/activate          # Windows: .venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8000
```

**Frontend** (port 3000):
```bash
cd frontend
npm run dev
```

- App → http://localhost:3000
- API docs → http://localhost:8000/docs
- Health → http://localhost:8000/api/health

**First-time database setup:**
```bash
createdb -h localhost -p 5432 -U postgres kaset
cd backend && alembic upgrade head
```
Alembic owns the schema outright. The app no longer calls `create_all` on
startup — that used to paper over a broken migration chain. If a table is
missing, the migration is missing. `alembic check` reports model/schema drift.

**Environment** — `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/kaset
JWT_SECRET= / JWT_REFRESH_SECRET=
TMDB_API_KEY=
FRONTEND_URL=http://localhost:3000
REDDIT_CLIENT_ID= / REDDIT_CLIENT_SECRET= / REDDIT_USER_AGENT=   # discovery, offline only
BRAVE_SEARCH_API_KEY=                                            # discovery, offline only
LLM_API_KEY= / LLM_MODEL=                                        # discovery extraction + evaluation
REDIS_URL=                                                       # optional
```
`frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000`

Every external service is gated by an availability check. The app runs without Redis, Reddit, Brave, or an LLM key — discovery simply serves whatever is already cached.

---

## 6. Design system

Kaset's visual DNA is **early-2000s web**: paper-toned surfaces, hairline rules instead of shadows, dense information, strong typography, and cassette/tape detailing. It should feel modern enough to use daily while carrying genuine early-internet DNA — not a costume, not a gimmick retro pastiche.

**Tokens** live in exactly two places, `frontend/src/app/globals.css` and its TypeScript mirror `frontend/src/lib/design-tokens.ts`. Never inline a hex value.

```
--paper          #F4F1EA    page base — manila / newsprint
--paper-raised   #FFFFFF    cards, sheets
--paper-sunken   #EAE6DC    wells, inputs, table stripes
--ink            #14120E    primary text
--ink-muted      #5A554A
--ink-faint      #8C8578
--rule           #C9C2B4    1px hairlines — the dominant structural device
--rule-strong    #14120E    section dividers, active tab underline
--tape           #8B2F1D    accent: oxide red (magnetic tape) — primary action
--tape-hover     #A93A24
--deck           #1B4D3E    positive / logged / confirmed
--highlight      #FFE9A8    selection, "new", annotation
--visited        #5B3E8C    visited-link violet, used sparingly
```

**Typography** — a tight grotesk for display and UI, and a **monospace for all metadata**: dates, runtimes, counts, ratings, watch types. That grotesk/mono split is what carries the cassette-label feel without costume.

**Rules:**
- Structure with 1px `--rule` borders, not shadows or glows.
- Posters are the visual centre. On paper they get a hairline border, never a glow.
- Density is a feature: compact rows, real tables in the Library, small-caps section headers.
- Motion is controlled. Framer Motion for component enter/exit and sheets; GSAP only for genuine timelines (Passport share-card reveal, log confirmation). Honour `prefers-reduced-motion`.
- No stock SVG animations, no Lottie filler, no clip-art icon packs.

---

## 7. Navigation

Four concepts. Same mental model on desktop and mobile.

```
HOME  ·  SEARCH  ·  YOUR LIBRARY  ·  CREATE
```

- **Desktop** — left rail carrying the four, with a Library sub-tree. Top bar carries Messages, Notifications, and the avatar.
- **Mobile** — bottom bar carrying the four, touch targets ≥44px. Messages and avatar sit in a compact top header.
- **Profile** is reached only through the avatar. **Messages** are globally accessible but never replace one of the four.
- Nothing else enters primary navigation. No Community, Discover, Match Cut, Tribe, or Releases.

`frontend/src/lib/nav.ts` is the single source of truth for both surfaces.

---

## 8. Feature systems

### Onboarding — 5 steps
Languages → favourite films → favourite cast/crew → optional viewing preferences → ready.
Purpose is cold-start personalisation, nothing more. Stores structured data only: selected languages, favourite films, favourite people, basic viewing preferences.

### Film page
Poster · title · metadata · rating · **Log this film** (primary action) · watchlist · review · *your previous viewing history* · community reviews · discover similar films.

### Logging & the diary
A user can search a film, open it, and log it with: date, rating, liked, review, rewatch flag, how they watched it, and tags.

Logging happens **inline on the film page** — the primary button expands in place into the log panel, and the film stays on screen. It is not a modal: a viewing is something you did to the film you are looking at, and a scrim over that film breaks the connection. The rating leads, because it is the one field almost everyone sets. The modifiers — liked · rewatch · private · spoilers — are icon toggles, not labelled checkbox rows.

A diary entry contains: **film · date · rating · liked · review · watch type · rewatch status · theatre information · tags · created timestamp.**

**Liked** is affection, a separate axis from rating, and like the rating it is a snapshot of *that viewing* rather than a standing fact about the film. **Tags** are free labels on a viewing, normalised lowercase and capped; V1 displays them but does not filter by them.

"Watched" is never a boolean. A user can watch the same film any number of times, and every viewing is preserved.

### Rewatch — first-class
```
Interstellar
  2024   ★★★★★
  2026   ★★★★★   Rewatch
```
New logs never overwrite old ones.

### Theatre visits
On logging, *How did you watch it?* → **Theatre · Streaming · TV · Other**, chosen as icons. Picking Theatre records **that you went**, and nothing further: asking for the cinema's name, city and format turned a two-tap action into paperwork, so the panel does not ask.

The `theatre_name` / `theatre_city` / `theatre_format` fields still live on the diary entry and the API still accepts them — the Letterboxd importer writes them, and older entries carry them — but no Kaset surface collects them. There is no theatre directory.

### Reviews
A review belongs to a viewing. It links user · film · diary entry · rating · text · timestamp, and surfaces on the film page, in the Passport, in profile activity, and in shared cards.

### Your Library
The user's personal cinema record: **Diary · Ratings · Reviews · Watchlist** (plus Watching/in-progress if it earns its place).

### Create
**Create Watchlist · Create Blend.** That is all it contains in V1.

### Watchlists
User-created collections. Create, rename, add films, remove films, reorder, share. The old "Slate" terminology does not appear anywhere in the Kaset UI.

### Kaset Passport
The user's cinematic identity — the reconceptualised profile. Shows profile information, films watched, total films, ratings, reviews, favourite films, favourite cast, favourite crew, watchlist, recent activity, diary, and yearly/monthly statistics. Viewable for yourself and for others, and built to be visually shareable.

### Passport sharing & Wrapped
Shareable visual cards for **Monthly Passport**, **Yearly Passport**, and **Wrapped** — films watched, theatre visits, rewatches, average rating, favourite film, most-watched actor/director, top films, recent films. Sharing is a designed surface, not an afterthought.

### Social
Follow other users, see their activity, open their Passport, send DMs, and share films in DMs. A shared film renders as a rich film card. Cinema-focused throughout — Kaset is not a general social network.

### Blends
A Blend combines the taste/activity of multiple users (A + B → shared recommendations), built on the discovery candidate pool. Deliberately simple; it does not recreate the old Match Cut architecture.

### Search
A primary destination and the entry point into discovery. Supports **films** and **people**. On entry it shows the search field, recent searches, recommended discovery, films from the user's taste/history, and relevant discovery modules. There is no separate top-level Discover destination.

---

## 9. Discovery engine

Kaset's discovery is **evidence-first**. The LLM never invents recommendations; it ranks a pool that external evidence produced.

```
SEED FILM
  → SEARCH INTENTS       "movies like {film}" · "films similar to {film}"
                         "what to watch after {film}" · "{film} recommendations"
                         "if you liked {film}"
  → COLLECT EVIDENCE     Reddit (primary) + Brave web: film sites, blogs,
                         recommendation articles, discussions, YouTube metadata
  → EXTRACT CANDIDATES   LLM returns structured JSON titles — never prose
  → RESOLVE VIA TMDB     unresolved titles are DROPPED, never recommended
  → CANDIDATE POOL       ~20–100 candidates depending on evidence availability
  → SCORE                transparent, configurable, every feature recorded
  → RANK                 lens = COMMUNITY  |  lens = FOR YOU
  → LLM EVALUATE         constrained to the pool; returns exactly 5
  → OUTPUT               [{ tmdb_id, rank, confidence, reason, evidence_refs[] }]
```

**Evidence retained per candidate:** source · source URL · subreddit/site · mention context · mention count · evidence text · source authority · sentiment/relevance. Raw mention counts are never the whole story.

**Scoring** — weights are configurable, never hardcoded permanently:
```
score =  community evidence        (mentions × source authority, log-damped)
       + cross-source agreement    (distinct sources and source types)
       + contextual similarity     (TMDB genre / language / era / crew overlap)
       + user taste relevance      (FOR YOU lens only)
       + novelty / freshness
       − already watched
       − already rated
       − weak evidence
```
Every intermediate feature is persisted so the weights can be evaluated against real outcomes later.

**Two lenses, one pool.** `COMMUNITY` answers *"what are people recommending after this film?"*; `FOR YOU` answers *"what is most likely to work for this user?"*. Only the ranking layer differs.

**Non-negotiable constraints:**
- Never ask the LLM "give me five films like X."
- The evaluator's output is filtered against the pool in code. The guarantee does not depend on the model complying.
- All external APIs stay behind `integrations/`. No frontend route calls an external API directly.
- The request path reads warm cache only. Expensive collection happens offline via `scripts/warm_discovery.py`.

**Personalisation** draws only on: onboarding favourite films, favourite people, language preferences, ratings, diary history, watchlist, and review/rating behaviour. No Neo4j, ALS, two-tower retrieval, XGBoost, or contextual bandits.

---

## 10. Data model

Roughly 24 tables. Reuse before adding; never duplicate a model.

```
CORE          users · user_preferences · movies
TASTE         language_selections · favorite_movies · favorite_people · viewing_preferences
VIEWING       diary_entries · ratings · reviews · watch_history
LISTS         watchlist_items · watchlists · watchlist_films
SOCIAL        follows · activity_events · conversations · messages · notifications
BLENDS        blends · blend_members
DISCOVERY     discovery_cache · discovery_evidence · reddit_cache
```

**Schema rules:**
- All physical columns are `snake_case`. No quoted camelCase.
- Every FK to `users.id` / `movies.id` is `ON DELETE CASCADE`, except two deliberate `SET NULL`s: `diary_entries.review_id` and `reviews.diary_entry_id`.
- No bare `tmdb_id` column without either a real FK or an explicit comment saying it is unresolved by design.

**Key relationships:**
- `diary_entries` has **no** unique constraint on `(user_id, movie_id)` — that is the entire point. Rewatches are separate dated rows.
- `ratings` holds the *current* rating (what shows on the film page). Each `diary_entries.rating` is the snapshot at that viewing (what the diary and Passport show).
- `watch_history` is a derived summary (first/last watched, count) maintained by the diary service, kept because Home, Passport, and discovery all need "has this user seen it?" cheaply.
- Theatre details are denormalised onto the diary entry.
- Film sharing in DMs is a `shared_movie_id` column on `messages`, not a separate table.

---

## 11. Conventions

**Backend**
- Absolute `app.*` imports. Never relative.
- Routes go in the owning `app/features/<slice>/`, then register in `app/routes/__init__.py`.
- Feature-only tables live in the slice; genuinely shared tables in `app/shared/models/`. Either way, add the module to `app/models_registry.py`.
- Keep route files thin. Business logic goes in a service.
- `diary_service` is the **single writer** for the diary + review + watch_history + ratings quartet. No route writes those tables directly.
- All external I/O lives in `app/integrations/`.

**Frontend**
- Call the API through `src/lib/api/` domain modules — never inline an endpoint string in a component.
- Pages go under `src/app/(main)/<slug>/page.tsx`. Use route groups, not directories, for shared layouts.
- Framer Motion for component enter/exit, gesture, and layout. GSAP for multi-element timelines.
- Colours come from tokens. Never inline a hex.

**Everywhere**
- ~1500 lines is the absolute ceiling for any file; aim well below it. Split by responsibility.
- Design the mobile version of a feature before building it. If you can't draw it on a phone, it isn't ready.
- Update a folder's `README.md` in the same change that alters the folder.
- The product name is always **KASET**.

---

## 12. Build status

The rebase runs in phases. No phase begins until the previous one is coherent.

| Phase | Scope | Status |
|---|---|---|
| 0 | Product specification and codebase audit | ✅ done |
| 1 | Brand and application shell rebase | ✅ done |
| 2 | Authentication and simplified onboarding | ✅ done |
| 3 | Film search and film detail | ✅ done |
| 4 | Logging, diary, ratings, reviews, rewatches, theatre visits | ✅ done |
| 5 | Kaset Passport | ✅ done |
| 6 | Following, activity, and DMs | ✅ done |
| 7 | Search / discovery UI | ✅ done |
| 8 | Evidence-based discovery engine | ✅ done |
| 9 | Watchlists and blends | ✅ done |
| 10 | Monthly/yearly Passport sharing and Wrapped | ✅ done |

**Every phase ends with the same gate:**
```
cd frontend && npm run typecheck && npm run build
cd backend  && python -c "import app.main"
```
plus manual verification of the routes it touched, a mobile check at 390×844, and updated READMEs.
