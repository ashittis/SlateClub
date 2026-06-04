# SlateClub

"Spotify × Letterboxd for movies" — a unified cinema platform for discovering, tracking, reviewing, and discussing films. Core differentiator: a proprietary mood-aware taste engine that recommends by tone, pacing, and storytelling style, not genre.

For the full product vision and screen-by-screen UX flow, read [vision.md](vision.md).
For the recommendation engine, taste graph, system design, and data flow, read [ARCHITECTURE.md](ARCHITECTURE.md).

## Working rules (read before every task)

1. **UI/UX first.** Design the experience before writing the code. For any feature, start from how it looks and feels — what the user sees, taps, hears, anticipates. Code serves the experience, not the other way around.
2. **Mobile + Web parity, device-independent.** Every feature ships for both surfaces and must feel native on each. `vision.md` separates Mobile vs Web for every page — match that convention. Touch targets ≥ 44px, no hover-only affordances, no mouse-only interactions.
3. **No stock SVG animations or generic graphics.** Use modern, performant motion — GSAP for choreographed/timeline animations, Framer Motion for component-level transitions and gestures (already a dep). Prefer CSS transforms + opacity for cheap motion; reach for canvas/WebGL when bubble-constellation/poster-fan needs it. No Lottie filler, no clip-art SVG icon packs — use Lucide or hand-crafted icons that fit the cinema-dark aesthetic.
4. **Spotify-style, UI-oriented app.** Bias every decision toward visual polish, motion, and discovery feel. Cinema-dark palette (deep blacks, selective coral/green/amber accents). Cards as the primary unit; posters treated as album art. Pill chips colour-coded by category (mood=amber, genre=green, language=tan, platform=purple, era=violet). Bubble constellations over grids where mood-native. See `vision.md` "Visual Language & Design System" for the full taxonomy.
5. **Small files, modular, production-oriented.** Treat ~1500 lines as the absolute ceiling for any single file; aim well below that. If a module is approaching the limit, split by responsibility (one schema per file, one pipeline stage per file, one route group per file). No god-files. No 3000-line "everything that touches movies" modules. Code should read like a layered system, not a brain dump.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16.2.3 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Framer Motion · Zustand · TanStack Query · GSAP (add when first needed) |
| Backend | Python 3.12 · FastAPI · async SQLAlchemy 2.0 · asyncpg · Alembic |
| Database | PostgreSQL 17 (running on **port 5433**, database `slateclub`) |
| ML | NumPy · scikit-learn · SciPy · XGBoost (4-stage rec pipeline: candidates → filter → rank → contextualize) |
| Optional | Neo4j (taste graph) · Anthropic Claude / Gemini (tone-tag extraction) |
| External | TMDB API (catalog, posters, search) |

## Project roots

- [backend/](backend/) — FastAPI app. Routes in `app/routes/` (~177 endpoints), models in `app/models/` (~30 SQLAlchemy tables), business logic in `app/services/`, ML in `app/ml/`, TMDB/LLM clients in `app/integrations/`. Migrations in `alembic/versions/`.
- [frontend/](frontend/) — Next.js App Router. Route groups: `(auth)`, `(main)` (home, discover, film/[slug], slates, circles, tribe, artists, festivals, releases, parties, profile, settings, community, activity), and an 8-step `onboarding/` flow. Components in `src/components/`, hooks in `src/lib/`.
- [figma-screens/](figma-screens/) — PNG design references (home, taste-engine, discovery). No code.

## Run commands

**Backend** (cmd.exe, port 8000):
```cmd
cd backend
.venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8000
```
PowerShell users: `.venv\Scripts\Activate.ps1` instead.

**Frontend** (cmd.exe or PowerShell, port 3000):
```cmd
cd frontend
npm run dev
```
The `dev` script already passes `--max-old-space-size=8192` to Node so Turbopack doesn't OOM on first compile.

- App → http://localhost:3000
- API docs → http://localhost:8000/docs
- Health → http://localhost:8000/api/health

## Environment

- `backend/.env` — `DATABASE_URL` points at `localhost:5433` (PG17), TMDB key already set, JWT secrets are dev-only placeholders.
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- Optional, add to `backend/.env` when you need them: `NEO4J_*` and `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`.

## Schema bootstrap (one-time, already done)

The first migration `0001_onboarding_signals` assumes base tables (`users`, `movies`, etc.) exist. Migrations 0001–0018 only add new feature tables. So the bootstrap order is:
1. `python bootstrap_db.py` — runs `Base.metadata.create_all` to create the base schema from SQLAlchemy models.
2. `alembic stamp head` — marks all migrations as applied without re-running.

For ongoing dev: write new migrations as normal (`alembic revision -m "..."` then `alembic upgrade head`). `main.py` also calls `create_all` on startup, so model-only changes appear automatically — but use Alembic for anything that needs a data migration or careful column change.

## Phased build status

`ARCHITECTURE.md` describes a 5-phase build. The codebase is currently around **Phase 4** (taste graph wired, 18 migrations applied, 51 tables, full route surface) with Phase 5 LLM layer scaffolded. Treat new feature work as additive — extend the existing route/service/model trio rather than introducing parallel structures.

## Conventions

- **Routes:** add to `backend/app/routes/`, register in `app/routes/__init__.py`'s `all_routers` list.
- **Models:** add to `backend/app/models/`, import in `app/main.py` and `alembic/env.py` so Base.metadata picks it up.
- **Frontend pages:** add under `frontend/src/app/(main)/<slug>/page.tsx`. Use route groups, not directories, for shared layouts.
- **Animations:** Framer Motion for component enter/exit, gesture, layout. GSAP for choreography that spans multiple elements or needs a timeline (taste-engine constellation, hero card fan, onboarding reveals).
- **Colours:** stick to the existing palette tokens. New accents only with reason — coral = action, green = positive/CTA, amber = mood, purple = platform, violet = era, tan = language.
- **Don't add a feature without designing the mobile version of it too.** If you can't draw it on a phone, it's not ready.
