# SlateClub — Features & Pages

> **"Spotify × Letterboxd for movies."** A unified cinema platform for discovering, tracking, reviewing, and discussing films — built around a proprietary **mood-aware taste engine** that recommends by tone, pacing, and storytelling style, not genre.

This document maps the whole product: what it is, the design language, and every page and feature area. It's derived from the live codebase (`frontend/src/app`, `backend/app/routes`) plus [vision.md](vision.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. The Core Idea

Most film apps sort by genre and star rating. SlateClub sorts by **how a film feels**. Every film is described in a taste space — tone, pacing, warmth, intensity, storytelling style — and every user builds a **taste profile** from their ratings, watch history, and micro-signals. Recommendations come from a **4-stage ML pipeline** (candidates → filter → rank → contextualize) layered on top of a **taste graph** that connects people and films by resonance rather than metadata.

The differentiator is compounding: the more you use it, the sharper your taste vector, the better the recs, and the harder the experience is to replicate.

---

## 2. Design Language

Cinema-dark aesthetic — deep blacks with selective accent colors. **Cards are the primary unit; posters are treated like album art.** Motion is first-class (GSAP for choreographed timelines, Framer Motion for component transitions/gestures). Everything ships for **mobile and web with parity** — 44px+ touch targets, no hover-only affordances.

**Color-coded pill chips by category:**

| Category | Color | | Category | Color |
|---|---|---|---|---|
| Action / CTA | Coral | | Platform | Purple |
| Positive / CTA | Green | | Era | Violet |
| Mood | Amber | | Language | Tan |
| Genre | Green | | | |

---

## 3. Onboarding — The "First Play" Moment

An 8-step flow that builds your initial taste vector before you ever hit the home feed. (`frontend/src/app/onboarding/`)

| Step | Page | What it captures |
|---|---|---|
| 1 | **Welcome** | Sets the tone; primes the taste-building ritual |
| 2 | **Languages** | Cinema languages you watch in |
| 3 | **Posters** (Gut Test) | Rapid poster swipe — instinctive attraction signals |
| 4 | **Mood** | Mood sliders (tone, pacing, intensity) |
| 5 | **Platforms** | Streaming services you have access to |
| 6 | **People** | Anchor artist(s) — a director/actor you love |
| 7 | **Origin** | Cinema origin story (optional narrative signal) |
| 8 | **Movies / Ready** | Seed films + taste-ready confirmation |

---

## 4. Pages

### Pre-login (`(auth)`)
- **Landing / Splash** — "Track. Discover. Remember." hero
- **Sign Up** / **Log In** — cookie-based JWT auth

### Home & Discovery
- **Home** (`/home`) — personalized feed: taste-engine picks, continue watching, network activity
- **Discover** (`/discover`) — curated sections, mood-native browsing, poster fans
- **Search** (`/search`) — films, people, users
- **Releases** (`/releases`) — upcoming & new releases, time-sensitive layer
- **Now Showing** (`/theatres` API) — theatre listings + showtimes per film/city *(activates once theatre/showtime data is ingested)*

### Films & Tracking
- **Film Detail** (`/film/[slug]`) — poster, taste breakdown, cast/crew, watch-state actions (Shelf / Watching / Watched / **DNF**), ratings, reviews
- **Series Detail** (`/series/[slug]`) — TV equivalent with the same tracking model
- **Slates** (`/slates`) — your library of lists/shelves; **create** (`/slates/new`), **detail** (`/slates/[id]`), **settings**
- **Profile** (`/profile`, `/profile/[username]`) — watchlist / watching / DNF / watched / ratings / slates tabs
- **Settings** (`/settings`) — account, preferences, **import** (`/settings/import`) from other services

### People & Social Graph
- **Artists** (`/artists/[tmdbId]`) — director/actor pages: filmography, taste fingerprint, follow
- **Orbits** — the friend system (search → request → accept); an accepted orbit is a mutual connection
- **Match Cut** (`/match-cut`, `/match-cut/[id]`) — pairwise **taste compatibility** between two people (shared / disagreed films) and **group consensus picks** for a movie night
- **Activity** (`/activity`) — friends' recent watches, rates, reviews
- **Notifications** (`/notifications`) — orbit requests, replies, mentions
- **Messages / DMs** (`/messages`, `/messages/[conversationId]`) — direct chat

### Community
- **Community** (`/community`, `/community/[id]`) — discourse threads (the "Reddit thread" layer)
- **Circles** (`/circles`, `/circles/[id]`) — **taste circles**: small interest groups
- **Tribe** (`/tribe`) — **Cinematic Tribes**: community-detected taste clusters you're algorithmically placed into
- **Chapters** (`/chapters`, `/chapters/[slug]`) — city-level public communities and their events
- **Festivals** (`/festivals/[slug]`) — festival hubs and lineups
- **Parties** (`/parties/[id]`) — watch parties / synchronized viewing

---

## 5. Feature Areas (Backend Surface)

~177 endpoints across ~40 route groups (`backend/app/routes/`). The notable systems:

**Taste & Recommendations**
- **Taste Engine** (`/api/taste-engine`, `/api/taste`) — builds and serves the user's taste vector
- **Recommendations** (`/api/recommendations`) — the 4-stage hybrid pipeline
- **Anchors** (`/api/recommendations` anchors) — "more films like *this one*" from an anchor film
- **Cultural intelligence** (`/api/cultural`) — Director Filmography Mode (chronological / best-to-worst), **The Connector** (path between two films via shared crew), and per-film **Cultural Context Cards**

**Tracking & Feedback**
- **Movies / Series** — watch-state machine keeping Shelf / Watching / Watched / **DNF** mutually exclusive
- **Ratings, Reviews, Comments** — with **helpful** signals
- **Watchlist, Watch History, Feedback** (micro-signals feeding the rec loop)
- **Imports** (`/api/import`) — bring in history from other platforms

**Social & Community**
- **Orbits** (friends), **Follows** (artists/users), **DMs / Chat**
- **Circles**, **Tribes**, **Chapters**, **Festivals**, **Watch Parties**
- **Discourse / Posts** — threaded community discussion
- **Critic Badges** (`/api/critics`) — algorithmically surfaces power reviewers (≥5 reviews in 30 days **and** median helpful_count ≥3)
- **Feed / Activity / Notifications**

---

## 6. Tech Stack (Quick Reference)

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Framer Motion · Zustand · TanStack Query · GSAP |
| Backend | Python 3.12 · FastAPI · async SQLAlchemy 2.0 · asyncpg · Alembic |
| Database | PostgreSQL 17 (~51 tables) |
| ML | NumPy · scikit-learn · SciPy · XGBoost (4-stage pipeline) |
| Graph / LLM | Neo4j (taste graph) · Anthropic Claude / Gemini (tone-tag extraction) |
| External | TMDB (catalog, posters, search) |

**Build status:** ~Phase 4 (taste graph wired, 18+ migrations, full route surface) with Phase 5 LLM layer scaffolded. See [ARCHITECTURE.md](ARCHITECTURE.md) for the recommendation engine, taste graph, and data flow.

---

*For the full product vision and per-screen mobile/web UX flow, read [vision.md](vision.md).*
