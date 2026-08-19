# KASET

A social film diary and discovery platform — *log the films you watch, discover what's next, see what your friends watch, build and share a cinematic identity.*

**Read [KASET.md](KASET.md) before any task.** It is the single source of truth for the product definition, the twenty V1 systems, the design system, the data model, and the discovery engine.

> This repo was rebased from a previous product called SlateClub. Those docs are archived in [files/docs/legacy/](files/docs/legacy/) **for reference only** — they are not the spec, and their feature scope is obsolete. If legacy docs and `KASET.md` disagree, `KASET.md` wins.

## Working rules (read before every task)

1. **Serve the loop.** Every feature must strengthen `onboard → discover → watch → log → rate → review → share → follow/DM → discover again`. If it doesn't, it isn't part of Kaset V1. Don't reintroduce removed systems (tribes, circles, chapters, festivals, watch parties, AMAs, critics, Match Cut, taste drift, the ML rec stack) — see `KASET.md` §2.
2. **UI/UX first.** Design the experience before writing the code — what the user sees, taps, and anticipates. Code serves the experience.
3. **Mobile + web parity.** Both surfaces ship together and must feel native on each. Touch targets ≥44px, no hover-only affordances, no mouse-only interactions. If you can't draw it on a phone, it isn't ready.
4. **Early-2000s web, not costume.** Paper-toned surfaces, 1px hairline rules instead of shadows, dense information, strong typography, grotesk + monospace split, subtle cassette/tape detailing. Modern enough to use daily. No gimmicky fake-retro, no stock SVG animations, no Lottie filler, no clip-art icon packs. Tokens only — never inline a hex.
5. **Evidence over invention.** Discovery is evidence-first. Never ask an LLM to name films; give it a resolved, evidence-backed pool and have it rank. Constrain its output in code, not in the prompt.
6. **Small files, modular, production-oriented.** ~1500 lines is the absolute ceiling; aim well below. Split by responsibility — one schema per file, one pipeline stage per file, one route group per file. No god-files.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16.3.1 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 (CSS-first, no config file) · Framer Motion · Zustand · TanStack Query · GSAP |
| Backend | Python 3.12 · FastAPI · async SQLAlchemy 2.0 · asyncpg · Alembic |
| Database | PostgreSQL 17 (port **5432**, database `kaset`) |
| External | TMDB · Reddit · Brave Search · an LLM provider |
| Optional | Redis (warm cache; degrades gracefully) |

No ML libraries, no graph database, no vector store. Kaset's intelligence comes from external evidence, not a trained model.

## Project roots

- [backend/](backend/) — FastAPI, organised as vertical feature slices. Each system lives in `app/features/<slice>/` with its own routes and owned models/services. Truly shared tables in `app/shared/models/`, cross-cutting logic in `app/shared/services/`, infra in `app/core/`, all external I/O in `app/integrations/`. `app/routes/__init__.py` is only a router registry; `app/models_registry.py` imports every model for `Base.metadata`.
- [frontend/](frontend/) — Next.js App Router. `app/` folders map to URLs; the feature grouping lives in `src/components/<feature>/`. Route groups: `(auth)`, `(main)`, plus a 5-step `onboarding/` flow. API access goes through `src/lib/api/` domain modules.
- [files/](files/) — reference docs and assets. `files/docs/legacy/` holds the archived SlateClub-era documentation.

Every folder has a `README.md` explaining its job in plain terms.

## Run commands

**Backend** (port 8000):
```bash
cd backend && source .venv/bin/activate   # Windows: .venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8000
```

**Frontend** (port 3000):
```bash
cd frontend && npm run dev
```
The `dev` script passes `--max-old-space-size=8192` so Turbopack doesn't OOM on first compile.

- App → http://localhost:3000 · API docs → http://localhost:8000/docs · Health → http://localhost:8000/api/health

**Database:** `createdb kaset` then `alembic upgrade head`. Alembic owns the schema outright — the app does **not** run `create_all` on startup (that masked a broken migration chain for months). Ongoing changes use Alembic normally (`alembic revision --autogenerate -m "..."` → `alembic upgrade head`); `alembic check` reports drift.

## Environment

- `backend/.env` — `DATABASE_URL` (localhost:5432/kaset), `JWT_SECRET`/`JWT_REFRESH_SECRET`, `TMDB_API_KEY`, `FRONTEND_URL`. Discovery-only and optional: `REDDIT_*`, `BRAVE_SEARCH_API_KEY`, `LLM_API_KEY`/`LLM_MODEL`, `REDIS_URL`. See `backend/.env.example`.
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:8000`

Every external service is availability-gated. The app must run without Redis, Reddit, Brave, or an LLM key.

## Conventions

- **Imports:** absolute `app.*` only (e.g. `from app.shared.models.movie import Movie`), never relative.
- **Routes:** add to the owning `app/features/<slice>/`, then register the router in `app/routes/__init__.py`. Keep route files thin — logic belongs in a service.
- **Models:** feature-only tables live in the slice; genuinely shared tables in `app/shared/models/`. Either way, add the module to `app/models_registry.py` so Alembic sees it.
- **Schema:** all columns `snake_case`. FKs to `users.id`/`movies.id` cascade, except the two deliberate `SET NULL`s (`diary_entries.review_id`, `reviews.diary_entry_id`).
- **Writes:** `diary_service` is the single writer for diary + review + watch_history + ratings. No route touches those tables directly.
- **External I/O:** only inside `app/integrations/`. No frontend route calls an external API.
- **Frontend API calls:** through `src/lib/api/` domain modules. Never inline an endpoint string in a component.
- **Frontend pages:** `src/app/(main)/<slug>/page.tsx`. Route groups, not directories, for shared layouts.
- **Navigation:** exactly four primary items — Home, Search, Your Library, Create. `src/lib/nav.ts` is the single source of truth. Profile is reached via the avatar; Messages are global but never a fifth item.
- **Animation:** Framer Motion for component enter/exit, gesture, layout. GSAP for multi-element timelines. Honour `prefers-reduced-motion`.
- **Colours:** tokens from `globals.css` / `lib/design-tokens.ts`. Never inline a hex.
- **Docs:** update a folder's `README.md` in the same change that alters the folder.
- **Naming:** the product is always **KASET**.

## Phase gate

The rebase runs in 10 phases (`KASET.md` §12). No phase begins until the previous one is coherent. Every phase ends with:

```bash
cd frontend && npm run typecheck && npm run build
cd backend  && python -c "import app.main"
```

plus manual verification of the routes it touched, a mobile check at 390×844, and updated READMEs.
