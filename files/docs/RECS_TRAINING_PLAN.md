# SlateClub Recs & Discovery — Training, External Sources, and the Discover Rebuild

> **Two halves.** **Tasks 1–5** train the untrained models and wire the idle adaptive layers (internal, ML).
> **Tasks 6–10** stop the engine relying on pure AI (Reddit + Letterboxd as real human signal) and rebuild
> Discover around one principle: *"I come here to avoid my confusion, not to confuse more."*
> The halves are independent; the only shared file is `alembic/versions/` (see Migration collision).

## Context

SlateClub's recommendation engine has real architecture but the two "learned" models never train and two adaptive layers are computed-but-ignored:

- **XGBoost ranker** (`xgboost_ranker.py`) — `.train()` exists, is never called; `self.trained` stays `False`; `rank()` always uses a fixed 12-weight sum.
- **ALS CF** (`als.py`) — `.fit()` is never called; `recommend()` returns `[]`; the `cf_score` slot is filled only by `graph_score × 0.8`.
- **Contextual bandit** (`contextual_bandit.py`) — records/persists rewards to `bandit_state.json`, but its learned per-segment weights are never read by `/for-you`.
- **Drift detector** (`drift_detector.py`) — `get_drift_adaptations()` is never called from the feed path.

Goal: train the two models **only if an offline harness proves they beat the current fallbacks**, and consume the two adaptive layers already producing data. This is done as **5 sequential tasks, stopping after each for review**. Out of scope for Tasks 1–5 (do NOT touch): Two-Tower, ANN/FAISS, sequential/session models, Movie Twins, Blend, Wrapped, comp-title captions.

### Context for Tasks 6–10 (external sources + Discover)

Two further problems, both product-level rather than ML-level:

1. **The engine runs on pure AI over marketing copy.** A film's semantic identity is GPT reasoning over TMDB metadata — and TMDB overviews are marketing copy that systematically omit tone, divisiveness, and pacing feel. Real human signal should feed it: **Reddit** (film-level: what viewers actually say) and **Letterboxd** (user-level: what you actually watched).
2. **Discover manufactures the confusion it exists to remove.** It fires **9 concurrent queries and paints ~90 posters** on mount, and its "something like ___" answer dumps **30 posters with unbounded "Show more"** — the single biggest dump in the app. Meanwhile `/for-you` (10 items) is the *most* restrained surface in the product. That inversion is the bug.

**Confirmed product decisions for Tasks 6–10:**
- **Sources = Reddit + Letterboxd.** Reddit = film-level enrichment; Letterboxd = user-level history. They are not interchangeable.
- **Hard 5, no Show more.** The "something like ___" answer is exactly 4–5 films, each with a reason. The pagination path is deleted.
- **Home absorbs Discover.** `/discover` and its nav item are deleted; the trimmed content moves to Home. **For You is a Home feature**, not a nav item, with "See all →" `/for-you`.
- **Discover trim: 10 sections → 3** (~90 posters → ~24).
- **Wire `/search` into nav** (it takes the freed Discover slot); delete the dead sentence-builder UI and the unused `/taste-engine` endpoints.

---

## `backend/docs/recommendation-improvements.md` is STALE — correct or delete it

That doc originated the Reddit idea and is wrong in five load-bearing ways. **Verify every claim in it against source before acting on it.** Correct it in place, or delete it with a pointer to this file.

| Claim in that doc | Reality (source-verified) |
|---|---|
| "Gemini" is the LLM throughout (`gemini_client.generate_json()`, "~$1 at Gemini paid tier") | **OpenAI.** `app/ml/llm/openai_client.py`, `gpt-5.5`, `text-embedding-3-large`, `settings.OPENAI_API_KEY`. No `gemini_client.py` source exists (only a stale `.pyc`). The extractor's own docstring prices at ~$0.01–0.03/movie. |
| (:22, :81-83) "Fill `_external_sources_for()` — **the hook is already called** and its output appended to the extraction prompt. Only the implementation is missing." Est. **~5h / Med**. | **`_external_sources_for` does not exist anywhere.** No hook, no call site, no external-text param in `movie_identity.py`. Reddit is **from-scratch infra**: HTTP client + OAuth + rate limiter + cache table + migration + prompt section + config + 2 scripts. The estimate is off by an order of magnitude. |
| (:35, :69, :315) Identity fields are `vibe, themes, tone_axes, audience, comparable_films` | `IDENTITY_SCHEMA` (`movie_identity.py:46-125`) requires `experiential_paragraph, vibe, affect_axes` (9 axes), `themes, comparable_by_feel, emotional_arc, narrative_dna, aftertaste`. **`tone_axes`, `audience`, `comparable_films` do not exist.** This invalidates its item #10 ("expand to 35 dims using `MovieIdentity.tone_axes`") — the real analogue is `affect_axes`/`affect_vector`. |
| (:85-126) "Add to requirements.txt: `praw>=7.0`" + a PRAW code sample | **praw is synchronous** — it would block the event loop inside the async extractor. `httpx` 0.28.1 is already a dep and is the only HTTP library present. Use httpx against Reddit's REST API. |
| (:18-22) Gap #2: "`bandit.record_reward()` is never called anywhere" | **Already shipped.** `services/watch_signals.py` records rewards on watch + rating and persists `bandit_state.json`. The live gap is *consumption*, which is Task 4 below. Its gap #1 (completion % discarded) is also shipped — `completion_pct_avg` is the 12th ranker feature and `watched_partial`/`abandoned` are in `SIGNAL_WEIGHTS`. |

Net: of its "three pure code gaps", **two are fixed and the third is fictional.**

### Two confirmed decisions (from clarifying questions)
- **Eval features = "Both":** add a nullable `features_json` snapshot column to `Impression` for clean future eval, AND point-in-time reconstruct features for existing historical impressions so Tasks 2–3 can train and gate today.
- **Bandit wiring = Stage-3 score multiplier** with mapping: `als→cf`, `graph→graph`, `trending→trending`, `content/semantic/per_lang/director→content`, Stage-4 explore picks→`serendipity`.

### Load-bearing facts discovered in source (not just docs)
- Impression (`models/social.py:69-92`) stores `surface, position, rank_score, source, session_id, shown_at` — **no feature values**. Table `impressions`, snake_case columns.
- Outcome timestamps for after-impression attribution: `Review.created_at` (clean), `DiaryEntry.created_at` (clean, per-viewing), `Rating.created_at`/`WatchHistory.watched_at` (upserted summaries — use with care). `actions.py` tables use **camelCase physical columns** (`userId`, `movieId`, `watchedAt`, `createdAt`); use ORM models, not raw SQL.
- `xgboost_ranker.train(features, labels)` guards `len(features) < 50` → silent no-op. **No disk persistence.** Fallback weights: `[0.17,0.10,0.15,0.00,0.05,0.05,0.05,0.05,0.10,0.05,0.20,0.03]`.
- `als.fit(interactions: list[dict])` expects `[{user_id, movie_id, weight}]`, guards `< 10` total interactions, sets no `trained` flag (implicit via `user_factors is not None`). **No disk persistence.**
- 12-feature build lives inline in `recommendation_pipeline._stage3_rank` (lines ~348-435). Feature order is authoritative there and in `xgboost_ranker.feature_names`.
- `get_drift_adaptations(drift_result)` returns `list[{adaptation, description}]` — **prose only, no numbers**. `compute_drift_score(all_interactions, recent_days=30)` derives its own vectors; threshold `DRIFT_THRESHOLD = 0.35`.
- `/for-you` (`routes/recommendations.py:273-485`): priors loaded at **line 350**; full interaction list assembled by **line 423**; graph prefetch **429-434**; `pipeline.run()` **437-447**; `log_impressions` **454-459**. `EXPLORE_RATIO = 0.3` is a module constant in the pipeline.
- Bandit segment classification pattern to reuse: `routes/taste.py:124-151` and `services/watch_signals.py:46-54` (`classify_user(rating_count, follow_count, days_since_signup)`; `discovery_seeker` is unreachable — leave as-is).
- Offline-script template: `backend/scripts/extract_movie_identities.py` (argparse in `main()`, `asyncio.run(run(...))`, own `create_async_engine` + `async_sessionmaker`, imports all `app.models.*` for relationship resolution, `engine.dispose()` at end).

---

## TASK 1 — Offline evaluation harness (build first; gates everything)

**New files:**
- `backend/app/ml/eval/__init__.py`
- `backend/app/ml/eval/feature_reconstruction.py` — point-in-time feature builder.
- `backend/app/ml/eval/harness.py` — join + metrics + report core (importable, reused by Tasks 2/3).
- `backend/scripts/eval_recs.py` — CLI entry (`python -m scripts.eval_recs`), models after `extract_movie_identities.py`.

**Feature reconstruction** (`feature_reconstruction.py`): extract the per-candidate 12-feature computation from `_stage3_rank` into a reusable `build_feature_row(candidate, priors, taste_vec, user_genres, ...) -> list[float]` and **refactor `_stage3_rank` to call it** (preserves the exact 12-feature schema — a pure extraction, no schema change). For a historical impression, rebuild the user's taste vector from only interactions with `created_at < shown_at` via `compute_user_taste_vector` (`ml/embeddings/taste_vector.py`). Document the one leaky feature: `semantic_similarity` uses the current `UserTasteState.taste_embedding` (no historical value stored) — acceptable, noted in the report.

**Harness** (`harness.py`):
- Pull `Impression` rows grouped by `session_id` (one slate). Join each to outcome tables on `(user_id, movie_id)` with outcome timestamp strictly `> shown_at`. **Converted** = watched (`WatchHistory.watched_at` / `DiaryEntry.created_at`) OR `Rating.value >= 4` (`created_at > shown_at`) OR `Review.created_at > shown_at`.
- **Baseline** = the order actually served (`position` / `rank_score`).
- **Candidate (shadow)** = re-score the same slate's movies with a passed-in scoring fn (trained model), re-rank within the slate.
- Metrics: **precision@10** (converted in top-10 of the ordering ÷ 10) and **take-rate** (converted impressions ÷ total impressions), computed for baseline and candidate over the same slates. Report `precision@k, take-rate, sample_size (slates, impressions, conversions)`.
- **Significance gate:** if impressions/conversions fall below a threshold (default `min_impressions=1000`, `min_conversions=100`, configurable), emit a prominent "INSUFFICIENT DATA — comparison not statistically meaningful" banner and **do not** render a pass/fail verdict. Also surface a two-proportion z-test p-value on take-rate when volume allows.

**Also (the "Both" decision):** add a nullable `features_json` (`JSON`) column to `Impression` (`models/social.py`) + Alembic migration (`0028_impression_features.py`); have `services/impressions.py:log_impressions` persist `item.get("_features")` when present, and have `_stage3_rank` stash the built row on each candidate as `_features`. This starts clean feature capture going forward; the harness prefers `features_json` when present and falls back to point-in-time reconstruction otherwise.

**STOP.** Report harness output on current data, including whether volume clears the significance gate.

---

## TASK 2 — Train XGBoost, gated by Task 1

**New:** `backend/scripts/train_xgboost.py` (CLI, same script skeleton).
- Positives: impressions whose `(user,movie)` has watched OR `rating>=4` OR review with outcome ts `> shown_at`. Negatives: impressions with no matching positive (shown-not-converted).
- Features: reconstruct via `feature_reconstruction.build_feature_row` (or read `features_json` where captured). **No feature add/remove** — the existing 12 only.
- Respect the `< 50 rows` guard; if under, report and stop.
- Add **persistence** to `xgboost_ranker.py`: `save(path)` (`self.model.save_model`) + `load(path)` (`xgb.Booster().load_model`, sets `self.trained=True`). Artifacts dir: `backend/app/ml/models/artifacts/` (gitignored). No new library — `xgboost` is already a dep.
- Train in the script, then run the **Task 1 harness**: trained-XGBoost (shadow) vs fallback (baseline).
- **Ship gate:** have `get_pipeline()`/ranker init `load()` the artifact **only if** it exists — but only *produce/commit* the artifact if the harness shows trained beats fallback on **both** precision@10 and take-rate. If it loses, leave no artifact, `self.trained` stays `False`, report clearly.

**STOP.** Report harness comparison; do not wire live unless it wins.

---

## TASK 3 — ALS readiness check, then train only if adequate

**New:** `backend/scripts/train_als.py`.
- **Readiness first:** count interactions per active user (ratings + watch history, matching ALS weight semantics) vs `min=10`. Report: % of active users clearing 10, and resulting matrix density (`nnz / (n_users × n_items)`).
- If too sparse → **stop, recommend deferral, do not train.**
- If adequate: build `[{user_id, movie_id, weight}]` (rating/5.0, watched=0.6, etc.), call `als.fit(...)`. Add `save/load` to `als.py` (pickle `user_factors, item_factors, _user_index, item_ids`; no new lib). Then run the **Task 1 harness**: does trained-ALS in the `cf_score` slot beat the current `graph_score × 0.8` fallback? Only wire live (load artifact in pipeline, use `als.recommend`) if it wins on precision@10 and take-rate.

**STOP.** Report readiness numbers first; report harness comparison if trained.

---

## TASK 4 — Consume bandit learned weights in /for-you (Stage-3 multiplier)

- In `routes/recommendations.py` `/for-you`: after priors, compute segment via the existing pattern (`bandit.classify_user(len(ratings), follow_count, days_since_signup)`; add the `Follow` count query + `days_since_signup` from `user.created_at` as in `routes/taste.py:124-151`). Get `bandit.get_blend_weights(segment)`.
- Pass those weights into `pipeline.run(...)` via a new `source_weights` kwarg → thread to `_stage3_rank`.
- In `_stage3_rank`, after computing `_rank_score`, multiply by the candidate's source-mapped bandit weight (mapping fixed above; explore/serendipity handled at Stage 4's explore pool). Normalize so absent weights default to neutral 1.0-equivalent (e.g. weight ÷ segment mean) to avoid globally deflating scores.
- Keep epsilon-greedy explore/exploit intact — this is **consumption only**. Reward logging path (`watch_signals.py`) is untouched and shares the same singleton + JSON file.

**STOP.** Report the wiring; verify weights are read per-request.

---

## TASK 5 — Wire drift detector into the feed path

- In `/for-you`, after the full interaction list is assembled (~line 423, before graph prefetch/pipeline run): call `compute_drift_score(interactions)` (reuse the already-built list).
- If `phase_transition` (drift_score > 0.35): translate `get_drift_adaptations(...)` names into concrete per-request overrides (the fn returns prose only, so define the mapping here, faithful to its descriptions):
  - `exploration_boost` → pass `explore_ratio_override=0.5` into `pipeline.run()` → Stage 4 uses it instead of `EXPLORE_RATIO=0.3`.
  - `accelerated_decay` → pass a decay override into the taste-vector build (0.5× weight for interactions >60d) for this request only.
- Thread overrides as optional kwargs on `pipeline.run()` (default = current behavior). **Do not** change `compute_drift_score` or its thresholds.

**STOP.** Report the wiring.

---
---

# PART TWO — External sources & the Discover rebuild (Tasks 6–10)

### Load-bearing facts for Tasks 6–10 (verified in source)

- **httpx 0.28.1 is the only HTTP library.** No praw, no bs4, no aiohttp, no requests.
- `integrations/tmdb.py` is the *entire* integrations package. `_fetch` (`:22-36`) retries 3× on transient **transport** errors only — **no 429 handling, no rate limiter, no cache**. There is **no shared HTTP client/retry helper** to reuse; `geo.py:78` builds a per-call client.
- `movie_identity.py`: `_build_prompt` (`:128-186`) takes TMDB metadata only; **insertion point for external text is `:183`**. `affect_vector` is packed post-hoc at `:260` (not LLM-generated). `_embedding_text` (`:189-225`) concatenates `experiential_paragraph` **twice** — a deliberate weighting toward felt experience.
- `scripts/extract_movie_identities.py` is **strictly sequential** (plain `for` at `:111`), no concurrency, **no rate limiting**. Skip-done via `identity_json IS NULL`; commits every 10; guards `llm.is_available()` (`:86-88`); imports 16 model modules for relationship resolution.
- `models/similar_cache.py` has **no TTL column** — freshness is `version`-gated only. **`alembic/env.py` does not import it**, so autogenerate has never seen it (and won't see a new cache table either).
- **Current migration head = `0027_watch_log`.** Task 1 above also claims `0028` — see Migration collision.
- **Letterboxd import already exists**: `routes/imports.py` `POST /api/import/letterboxd` (ratings/watched/watchlist CSVs) + UI at `frontend/src/app/(main)/settings/import/page.tsx`. It writes only the flat `WatchHistory` summary and **skips rows already in history** (`:174-179`) — discarding every per-viewing date.
- **Frontend `taste-engine` usage is exactly 3 call sites:** `/similar` ×2 (`discover/page.tsx:75,117`) and `/options` ×1 (`SentenceBuilder.tsx:62`, itself dead). `/query`, `/match-count`, `/presets` are called by **nothing**.
- `POST /taste-engine/query` (`:324-387`) is a **slot filter with no LLM and no natural language**; `mood` and `platform` are advertised as filters but only scale a global multiplier (`:365-368`) — they reorder nothing.
- `ForYouGrid.tsx:31` hardcodes `page: "1"` and omits page from the query key (`:37`) → the pipeline computes and impression-logs 30 but **pages 2–3 are unreachable from any client**; 20 of every 30 are thrown away. `session_mood` is also built in render, not in `queryFn`, so mood never varies the fetch.
- `AwardTile.tsx` renders a `<button>` with **no `onClick` and no `href`** — the tiles are inert; there is no destination.
- `tmdb.py` has **no `/watch/providers` wrapper** among its 22 functions — real platform data does not exist yet.

---

## TASK 6 — Subtract: dead code + the two fake endpoints (do first)

Pure subtraction, no new infra. Shrinks the surface every later task edits.

**Backend — `routes/taste_engine.py`.** Delete `POST /query` (+ `QueryRequest`, `QueryFilm`), `GET /match-count`, `GET /options` (+ `_MOOD/_GENRE/_LANGUAGE/_PLATFORM/_ERA_OPTIONS`), `GET|POST /presets`, and the newly-orphaned helpers `_build_filters`, `_era_to_year_range`, `_augment_from_tmdb`, `_TMDB_GENRE_IDS`, `_AUGMENT_CACHE`/`_augment_key`/`_augment_recent`/`_mark_augmented`, plus now-unused imports. Leaves the module ≈120 lines containing only `POST /similar` — **rewrite its docstring**, which currently documents five endpoints that no longer exist. Keep the filename and `/api/taste-engine` prefix.
> Deleting `/query` removes a lie, not just dead code: it advertises mood/platform filtering that does nothing.

**Keep `models/taste_engine.py` `TastePreset` + its table.** Its only consumers are the deleted `/presets` handlers, but dropping a user-data table is irreversible for zero gain. Leave `0002_taste_presets` alone; confirm empty and drop in a later cleanup.

**Frontend deletions** (all verified zero-importer): `components/taste-engine/SentenceBuilder.tsx`, `components/taste-engine/SwapSheet.tsx` (imported only by SentenceBuilder), `components/taste-engine/BubbleConstellation.tsx`.

**Delete `GET /api/discover/by-platform`** (`discover.py:61-83`). `personalisedCount = max(20, count(popularity>5)//(i+3))` — a global count divided by tile index, **identical for every user**, while `user: User = Depends(get_current_user)` is injected and never read, under a section titled *"Only what you can actually watch."* Remove the route, `_PLATFORMS` (`:25-32`), `components/discover/PlatformTile.tsx`, and its Discover section + query.
> *Follow-up (separate task, the honest version):* needs (1) a `streaming_providers` JSON column on `Movie` + migration, (2) a new `tmdb.get_watch_providers()` wrapping `/movie/{id}/watch/providers` — **not currently wrapped** — region-scoped via `services/geo.py`, (3) backfill in the enrich batch, (4) return as a **filter on the answer** ("only what I can stream"), not a browse row. The same call would let `services/trending.py`'s "ott" row stop inferring.

**Delete `GET /api/discover/awards`** (`discover.py:113-115`). Six hardcoded labels, no DB — and `AwardTile.tsx` renders inert buttons with no destination. Remove the route, `_AWARDS` (`:34-41`), `AwardTile.tsx`, its section + query. A real version belongs in the existing `models/festivals.py` / `/festivals` page, which already have structure — Discover should link there once they carry award data, not re-fake it.

**STOP.** Report: app boots, `npm run build` passes (the build is the real proof the deleted components had no importers), `/openapi.json` shows `/api/taste-engine/similar` as the only `taste-engine` path.

---

## TASK 7 — The 5-film answer

**Decision: ask ~30, cache 30, serve 5.** Rationale (state it, because "just ask for 5" looks cheaper and isn't):
- **Cost is identical** — one LLM call either way.
- **The escape hatch becomes free.** "None of these fit" must yield 5 *different* films. From a 30-pool that's an offset into cached JSON — zero latency, zero LLM. From a 5-ask it's a fresh call with exclusions, i.e. exactly the "Show more" this task deletes, wearing a hat.
- **`SimilarCache` is keyed on `seed_tmdb_id` alone** — one 30-pool payload serves every offset *and* every language filter; a 5-film payload needs a row per page.
- **Selection quality.** `_essence_prompt:196-201` asks for a spread across languages, closest-feel first. Ranking 30 and taking the top 5 beats asking for 5 cold — and the language filter needs a pool to filter over.
- **The `<4` trust floor survives.** `_essence_films:304` bails under 4 resolved films; asking for 5 and losing 2 to TMDB resolution trips it constantly, asking for 30 makes it near-impossible.

**`services/similar_films.py`:**
- Add `_POOL_SIZE = 30`. **Drop `limit` and `exclude_ids`** from `find_similar_films` (`:376-382`) — the payload is always the 30-pool. This deletes the exclusion branch (`:241-251`, `:401-407`, `:453-457`), `_essence_prompt`'s `exclude_titles`/`exclude_section` (`:152`, `:172-177`, `:203`), and the per-exclusion-set memo cache entirely.
- `_essence_prompt:202` — the reason is now the **headline of the answer**, not a caption. Change `"a <=6-word reason"` → **"one plain-English line, max 12 words, naming the shared feeling — not the plot"**; widen `_ESSENCE_SCHEMA.films.items.why.description` (`:63-66`) to match.
- **Bump `_ESSENCE_VERSION` 2 → 3** (`:42`) **in the same commit as the prompt change** — never separately. The `why` contract changed; the existing gate (`:420`) invalidates every cached row and `:462-472` lazily repopulates. No migration.
- **Keep the `explanation` result key** — `_cosine_similar_films:546-547` and `_creator_row:351` both already emit it; renaming touches the fallback for no gain.
- New **pure** helper (no I/O, unit-testable): `answer_slice(payload, *, offset=0, languages=None) -> {seed, essence, answer, creatorRow, poolSize, offset, hasMore}`. Filters by `originalLanguage`, slices `[offset:offset+5]`. `creatorRow` only when `offset == 0` and unfiltered — moving the existing page-1 rule (`discover/page.tsx:167-168`) server-side where it belongs.

**`POST /api/taste-engine/similar`** — new contract:
```python
class SimilarRequest(BaseModel):
    tmdb_id:    int       = Field(alias="tmdbId")
    media_type: str       = Field("movie", alias="mediaType")
    offset:     int       = Field(0, ge=0, le=25)      # 5-film page into the cached 30
    languages:  list[str] = Field(default_factory=list) # ISO-639-1, server-sliced
    # limit REMOVED. exclude_ids REMOVED.
```
Response returns **`answer`** (exactly 4–5), not `results` — a deliberate key break so nothing silently renders 30 against the new contract. Plus `essence`, `creatorRow` (≤6, offset-0-unfiltered only), `poolSize`, `offset`, `hasMore`.

**Frontend:**
- **New `components/discover/SimilarAnswer.tsx`** — *not a grid*. A list of ≤5 rows: 64px poster thumb, title + year, **the `explanation` line as the primary text** (it *is* the answer), a `matchScore` pill. `essence` renders as a lead-in sentence above the list. Footer: **"None of these fit →"** (`offset += 5`, disabled when `!hasMore`) and **"Try a different film"**. When `hasMore` is false: *"That's everything close to {title}. Try a different film."*
- **Delete** `components/discover/SimilarResultsGrid.tsx` (6-col grid, 12-item skeletons — all wrong for a 5-item answer) and `components/discover/PaginationBar.tsx`.
- Strip `extraPages`, `pageIndex`, `moreMut` (`:115-131`), `showMore` (`:135-144`), `allPages`, `seenIds`, and the client-side `similarDisplay` filter (`:155-170`) — the server slices now. `offset` state replaces `pageIndex`; `languages` goes in the request body.
- `MoviesLikeBuilder.tsx`: drop props `hasResults`/`onMore` (`:33-36`), the `isMore` branch (`:107`), and the Show-more CTA states (`:300-306`). The button is only ever "Show me →".
- **Keep `MovieFilterModal.tsx`** (language filter, now server-sliced).
- **Incidental bug fixed:** the query cache writes `["movies-like", seed.id]` (`:61`) but reads `["movies-like", seed.id, mediaType]` (`:73`) — refresh-restore never hits today. Include `offset` + `languages` in the new key.

**STOP.** Report the new contract + a sample answer.

---

## TASK 8 — Home absorbs Discover; For You becomes a real feature

**Delete `frontend/src/app/(main)/discover/page.tsx`** and remove **Discover from `lib/nav.ts`** (desktop `:12-19`, mobile `:25-31`). Consider a redirect `/discover → /` rather than a 404 for existing links/bookmarks.

**Keep `routes/discover.py`** — `/trending` and `/artists-radar` are real and stay consumed (by Home and `/profile` respectively).

**Home (`app/(main)/home/page.tsx`) becomes the hub** — identical desktop + mobile, **3 content queries / ~24 posters** (down from 9 / ~90):
1. Search tap-target → `/search`
2. **"Show me something like ___"** → the 5-film answer (Task 7). The page's reason to exist; empty state *is* the page.
3. **For You** feed + "See all →" `/for-you`
4. One **"In theatres | New on OTT"** toggle row — a single `/api/discover/trending` call already returns both (`discover.py:48-58`); `PER_ROW = 12` ⇒ 12 posters, not 24 stacked.
5. **Hidden gems** (`/api/cultural/hidden-gems`) — honest (real twin ratings vs. real global vote counts), low-volume, and the one row surfacing something unfindable alone.

**Relocate, don't delete** (each has a real home):
- "Slates worth saving" + "From your twins' shelves" → `/slates` (already has `?tab=saved`)
- "Artists on your radar" → `/profile` (it's `FavoritePerson`-driven — a profile fact, not a discovery)
- "Your twins right now" → `/community` — it's a **60s-poll liveness row** (`refetchInterval: 60_000`); it belongs where people are, and this removes a poll from the landing page.

**For You:**
- New `app/(main)/for-you/page.tsx` — `"use client"`, the `mx-auto max-w-7xl px-4 lg:px-6 pt-6 pb-24` shell, `<h1>For You</h1>`, `<ForYouGrid variant="full" />`.
- `ForYouGrid` → `useInfiniteQuery`: `queryKey: ["for-you", sessionMood, variant]`, `getNextPageParam: last => last.page * 10 < last.total ? last.page + 1 : undefined`. **Build the `session_mood` param inside `queryFn`** (today it's built in render — that's why mood never varies the fetch).
- `variant: "preview" | "full"` — Home shows 6 + "See all →" (keeps Home light); `/for-you` pages through all 30 with a "Show more" gated on `hasNextPage`.
  > This "Show more" is **not** the one Task 7 deletes: it pages a *precomputed 30-item ranked list* — no LLM, no cost, no new inference.
- **No For You nav item** — it's a Home feature by decision.

**Nav after this:** the freed Discover slot goes to **Search**.
- Mobile → `Home, Search, Slates, Community, Profile`. Add a `/search` entry to `layout.tsx`'s `MOBILE_ICONS` (`:8-46`) and remove `/discover`, else `:84` renders `null` and the tab shows a bare label.
- Desktop drops Discover; keep `TopNav`'s `MovieSearchBar`. Add a **"See all results for '{q}' →"** footer to its dropdown → `/search?q=`, and seed `search/page.tsx`'s query from `useSearchParams().get("q")`. (`search/page.tsx` is fully built and today reachable only by typing the URL.)

**Flag for Task 1:** reachable pages 2–3 ⇒ **~3× the impression rows** (`log_impressions` currently only ever logs page-1 items, so the eval harness sees one-third of what the pipeline produces). Good for the harness — note it so the volume jump isn't misread as a bug.

**STOP.** Report the new Home + nav.

---

## TASK 9 — Letterboxd: fix what the existing import throws away

**The definitive answer, to state plainly: there is no Letterboxd API and no OAuth — none, not "not yet."** No public developer program; the private API behind their apps is unpublished and unauthorised for third parties. **Scraping is not on the table** (ToS-prohibited, brittle, risks the account). **The CSV export is the sanctioned path and it already exists.** The work here is not "build Letterboxd import" — it is **fix what the existing import discards.**

**The bug:** `imports.py:154-189` writes a flat `WatchHistory` row per film and skips any film already in history (`:174-179`). So:
- **The Diary tab is empty** for imported users — `routes/diary.py` reads `DiaryEntry` (`watch_log`), which the import never writes.
- **Wrapped is empty for every past year** — `routes/wrapped.py:63,84-88` aggregates `DiaryEntry.watched_at` exclusively. **A user importing 8 years of Letterboxd gets zero Wrapped years.**
- **Rewatches are silently dropped** — skip-if-exists makes a second viewing unrepresentable, which is precisely what `watch_log` exists to hold.

**Accept `diary.csv`** — the export's actual per-viewing file, and the key change. Add `diary: UploadFile | None = File(default=None)` as a 4th part; update the guard (`:104`) and `counts` (`:109-113`).

| Column | Use |
|---|---|
| `Date` | date the entry was *added* — **ignore** |
| `Name`, `Year` | TMDB resolution (existing `_resolve_tmdb`) |
| `Rating` | → `DiaryEntry.rating` snapshot + canonical `Rating` upsert |
| `Rewatch` | `"Yes"` → `is_rewatch=True` (**authoritative** — don't infer when present) |
| **`Watched Date`** | → `DiaryEntry.watched_at` — **the field the whole feature hinges on** |

`watched.csv` is one row per film with `Date` = date added, so it's a **degraded fallback**: use it only for films absent from `diary.csv`, one `DiaryEntry` each.

**Rewrite the watched/diary section** around a new `_import_viewings(db, user, rows, *, source, visibility, counts)` helper:
- **Import `services/diary_service.upsert_watch_summary`** — do not hand-roll. Its advance-only `watched_at` rule (`diary_service.py:33-57`) is exactly right when replaying a CSV in arbitrary order.
- **Delete the skip-if-exists branch** (`:174-179`) — the single most important edit here. Its replacement is the diary-level dedupe below.
- **Do NOT call `clear_lifecycle`.** `routes/diary.py:130` calls it on every in-app log (wiping Watchlist/CurrentlyWatching/DNF), but in a bulk import it would delete watchlist rows the same request is importing. Process **`ratings → diary → watched → watchlist`** and **comment why the omission is deliberate** — it looks like a bug otherwise.
- **`_parse_date` returns `datetime.now()` on failure** (`:81-87`) — for a diary that silently lands a 2019 viewing in 2026 and corrupts Wrapped. Add `_parse_date_or_none`; unparseable → `counts["diary"]["skipped"]`, **never a fabricated date**. Store at **12:00 UTC** (matching `diary.py:_resolve_watched_at:66-69`) so a date can't straddle a year boundary under timezone conversion — critical for Wrapped bucketing.
- **`is_rewatch`:** (1) CSV `Rewatch == "Yes"` → True; (2) else infer — sort that film's rows by `Watched Date` ascending, first False, rest True; (3) also True if `summary_had_row()` was true **before this import touched the film** (snapshot per film first — `upsert_watch_summary` makes it true).
- **Idempotent re-import** via **importer-side dedupe on `(user, movie, watched_at.date())`** — load existing dates once per film (`ix_watchlog_user_movie` covers it), union with dates written earlier in the same request, skip on hit. **No unique constraint, no migration:** `DiaryEntry` is deliberately non-unique because two genuine same-day viewings are legal in-app. Documented trade-off: **two same-day viewings in one CSV collapse to one entry.** Do not add a partial unique index — it would break legitimate in-app logging.
- **`visibility`:** add `visibility: str = Form("public")`, validate `in ("public","private")` as `diary.py:100` does; surface a toggle on the import page — importing 8 years of history is the one moment a user may want it private. Both settings still count in the owner's Wrapped.

**Performance** (the import is already at its limit; this makes it worse — every row is one sequential TMDB search, and rewatches re-search the same title):
1. **Per-request resolution memo** `dict[(title, year), dict|None]` shared across all four CSVs — rewatches and the ratings/diary/watched overlap collapse to one TMDB call each (typically **3–5×** on a real export).
2. **Bounded resolve phase**: collect unique `(title, year)` → `asyncio.gather` under `asyncio.Semaphore(5)` → then walk rows sequentially for `_ensure_movie` + `DiaryEntry` + `upsert_watch_summary`. **Network-concurrent / DB-sequential**, the `similar_films.py:260-261` precedent.
   > **Risk:** `tmdb.py:_fetch` has **no 429 handling** — 5-way concurrency against TMDB search is where that bites first. Drop to 2, or port Task 10's limiter into `tmdb.py`. Follow-up, not a blocker. A job queue remains the real answer and stays out of scope.

**Payoff:** retroactively fills the **Diary tab** and **Wrapped for every past year**.

**Optional later — Letterboxd RSS (out of scope; do NOT scrape).** `letterboxd.com/{username}/rss/` is a feed **Letterboxd officially publishes and serves** — consuming it with httpx is categorically different from scraping HTML, and is the sanctioned route for *ongoing* sync (CSV is a manual point-in-time export). Each `<item>` carries `letterboxd:watchedDate`, `letterboxd:rewatch`, `letterboxd:memberRating` **and `<tmdb:movieId>`** — the TMDB id is *in the feed*, deleting `_resolve_tmdb` and the whole perf problem for the sync path. Sketch: `integrations/letterboxd.py`, a `letterboxd_username` column, a nightly `scripts/sync_letterboxd.py` reusing `_import_viewings` with the same dedupe. Public diaries only; ~50 most recent ⇒ it's a **delta** mechanism, CSV stays the backfill.

**STOP.** Report the fixture results — especially `GET /api/wrapped/years` including a past year.

---

## TASK 10 — Reddit enrichment (offline-only, last)

**Why it's worth it:** TMDB overviews are marketing copy. Reddit comparison sentences ("feels like early Tarkovsky", "fans of Bong Joon-ho will love this") are exactly the signal `comparable_by_feel` needs, and are strongest where the LLM's base knowledge is weakest — non-English and arthouse. **One artifact bootstraps both paths:** `/for-you` semantic candidates (via `identity_embedding`, built by `_embedding_text` which already concatenates `comparable_by_feel` + `vibe`) **and** the essence answer (via `similar_films._seed_identity_block:114-149`).

**`core/config.py`** — three fields, mirroring the `""`-default convention (absence never crashes import):
```python
REDDIT_CLIENT_ID: str = ""
REDDIT_CLIENT_SECRET: str = ""
REDDIT_USER_AGENT: str = "slateclub/1.0 (offline identity enrichment)"
```
Also bring the stale `.env.example` (6 of ~14 vars) to parity — it's missing every AI/Neo4j/Redis key — and note its DB port should say **5433**.

**New `integrations/reddit.py`** — httpx, modelled on `tmdb.py`'s singleton-client + `_TRANSIENT` retry shape, but adding the two things tmdb.py lacks:
- **OAuth2 client-credentials** (script app): `POST https://www.reddit.com/api/v1/access_token`, HTTP Basic, `grant_type=client_credentials`, explicit `User-Agent` (Reddit 429s a default/absent UA aggressively). Cache token + expiry, refresh at −60s, **single-flight behind an `asyncio.Lock`** so concurrent workers don't stampede. On 401: clear token, retry **once**, don't loop. Calls go to `https://oauth.reddit.com` with `raw_json=1`.
- **Global async rate gate** — `_MIN_INTERVAL = 1.0s` ⇒ **≤60/min regardless of `--concurrency`** (Reddit's OAuth budget is ~100 QPM averaged; be conservative). Acquire lock → sleep until `_last_call + interval` → stamp → release → *then* request. Read `x-ratelimit-remaining` / `x-ratelimit-reset` and widen the interval when `remaining < 5` (self-tuning, no config).
- **429/5xx backoff** honouring `Retry-After`, else exponential with jitter, max 3 attempts, then return `None`/`""` — **never raise into the batch loop**; a silent skip is the intended degradation.
- `is_available()` mirroring `llm.is_available()`.
- **Search:** `GET /r/{multireddit}/search`, `restrict_sr=1`, `sort=relevance`, `type=link`, `limit=5`, query `"{title}" {year}` — **the quoted title is what kills false positives**. Subs: `movies+TrueFilm+criterion+horror+flicks` plus a language-conditional sub from `original_language` (hi/ta/te/ml/kn → bollywood+kollywood+tollywood+MalayalamMovies+kannada; ko → koreanfilm; ja → JapaneseMovies).
- **Comments:** `GET /comments/{id}`, `limit=25`, `depth=1`, `sort=top`; Reddit returns a 2-element listing — read `[1].data.children[*].data.body`; skip `kind == "more"` and `[deleted]`/`[removed]`.
- **Budget: ≤6 requests/film ⇒ ~6s wall-clock at 1 req/s.** This is *why* the cache and a separate warm script exist.
- **`discussion_text()`** — pure, testable: regex `like|similar to|reminds me of|feels like|compared to|fans of|if you liked|in the vein of|same energy as|companion piece` → strip → drop <25 or >280 chars → drop sentences with URLs or `>` quote blocks → dedupe case-insensitively on a whitespace-normalised key → keep relevance order → join → truncate **3200 chars ≈ 800 tokens**. Return `""` when unavailable — every caller treats `""` as "no external context".

**New `models/reddit_cache.py` + migration** — copies `similar_cache`'s shape but **fixes its gap**: `similar_cache` has no TTL and relies on the version gate alone, which is wrong for Reddit (threads accrete). Use a composite PK **`(tmdb_id, month "YYYY-MM")`** + `version` + `payload` (`{text, sentences, fetched_at}`) + `created_at`. Freshness then needs **no TTL column and no sweeper** — a lookup computes the current month and misses at the boundary automatically. `_REDDIT_CACHE_VERSION = 1`; bump when the regex or sub list changes. **Add `reddit_cache` *and* `similar_cache` to `alembic/env.py`'s import list** (neither is there today, so autogenerate would try to drop them). Hand-write the migration like `0022_similar_cache.py`.

**`movie_identity.py` — enrich inputs, keep the schema stable.**
- **Do NOT change `IDENTITY_SCHEMA` or `_embedding_text`.** Reddit is an **input**, not an output; it reaches the vector transitively (prompt → better `comparable_by_feel`/`vibe`/`aftertaste` → `_embedding_text` already concatenates all three). A `reddit_quotes` output field would pollute the vector with other people's prose and break the deliberate `experiential_paragraph`-twice weighting (`:220-221`). Zero schema churn also keeps existing identities readable by `_seed_identity_block` and `_affect_vec`.
- **Keep the module network-free — it must never import `integrations.reddit`.** Thread the text in as a parameter so the *caller* owns the I/O: `_build_prompt(movie, external_text="")`, `extract_identity(movie, *, external_text="")`, `extract_and_embed(movie, *, external_text="")`. All default `""` ⇒ every existing call site is source-compatible. **This is the structural guarantee that Reddit can never run on the request path.**
- **Insert at `:183`**, between the movie block and the "Return ONLY JSON" tail, emitted **only when `external_text.strip()`** (otherwise the prompt is byte-identical to today's): a clearly-labelled `--- AUDIENCE CHATTER (unverified Reddit comments; may be wrong, sarcastic, or about a different film with the same title) ---` block, with rules — use **only** as evidence for how the film *feels* and for `comparable_by_feel`; never quote it; never repeat a comparison you can't stand behind; ignore spoilers, hype, box-office, star-ratings; **if it contradicts the metadata above, trust the metadata**; if empty or off-topic, ignore entirely.
- **Provenance:** beside the existing `affect_vector` pack (`:260`), set `identity["_meta"] = {"sources": ["tmdb","reddit"] if external_text.strip() else ["tmdb"], "prompt_version": 2}`. Lets you target TMDB-only rows later (`identity_json->'_meta'->>'sources'`) with no schema change; the leading underscore matches the existing post-hoc-field convention.

**Scripts — split, because one is Reddit-bound and the other OpenAI-bound:**
- **New `scripts/enrich_reddit.py`** — warms `reddit_cache` only; no LLM, no embeddings, no `Movie` writes. You pay the Reddit wall-clock **once**, then re-run extraction freely (prompt tweaks, model swaps) against a warm cache. Follows the `extract_movie_identities.py` skeleton exactly (argparse, own engine/sessionmaker, the same 16 model imports **plus `reddit_cache`**, commit every 10, `engine.dispose()`), guards `reddit.is_available()`. Flags: `--limit`, `--refresh`, `--concurrency`.
- **`scripts/extract_movie_identities.py`** — add `--with-reddit` (cache hit → pass text; miss → fetch live + write cache, so it's self-sufficient) and `--concurrency N` (**default 1** = today's exact behaviour). Without `--with-reddit`, byte-identical to today.
- **The AsyncSession trap:** `_process_one` currently does network *and* `session.flush()` together, and **`AsyncSession` is not safe under concurrent use** (`similar_films.py:260-261` already documents this precedent). Restructure `run()` into chunks of N: **(1) fan out — network only** via `asyncio.gather`, each wrapped so one failure returns `(None, None)` rather than cancelling the gather; **(2) fan in — DB only, sequential**, assign fields + one `flush()` per chunk; (3) commit every 10. **Comment this loudly** — if a future edit puts a `flush()` back inside the gathered coroutine it will corrupt sessions non-deterministically.
- Reddit's limiter is global, so `--concurrency 4` still can't exceed 60/min. OpenAI has **no** limiter — cap at ~4 and treat a burst of `openai.generate_json failed` warnings (`openai_client.py:161`) as the signal to back off. A dedicated OpenAI limiter is out of scope; the per-movie `None` degrades safely.
- **Runbook:** `python -m scripts.enrich_reddit --limit 200 --concurrency 4` (≈5 min) → `python -m scripts.extract_movie_identities --limit 200 --with-reddit --concurrency 4`.

**STOP.** Report a `discussion_text` spot-check before any bulk run.

---

## Ordering, collisions, risks (Tasks 6–10)

**Order: 6 → 7 → 8 → 9 → 10.** Subtraction first (shrinks what everything else edits); Reddit last (biggest new surface, needs credentials, payoff is a slow batch). Each is independently shippable — **stop after each**.

**Migration collision:** Task 1 claims `0028_impression_features.py`; Task 10 needs a `reddit_cache` migration. Both are additive and independent — whichever lands second renumbers to `0029` and re-points `down_revision`. Just don't create them simultaneously. Current head is `0027_watch_log`.

**Risks:**
- **`_ESSENCE_VERSION = 3` cold-starts every cached seed** — every popular film's next request pays a full LLM + 30× TMDB round-trip. Expected and self-healing, but the first hour post-deploy is slow. Don't ship it Friday.
- **`/similar` contract break** (`results`→`answer`, `limit`/`excludeIds` gone) — the endpoint is **public/unauthed**, so any external caller breaks. Backend + frontend must ship together.
- **Deleting `/discover`** — check inbound links; prefer a redirect to `/` over a 404.
- **Reddit title ambiguity** — `"Parasite" 2019` is fine; `"Her"`, `"It"` will pull unrelated threads. The quoted-title+year query and the trust-the-metadata prompt rule are the mitigations, but expect noise. **Spot-check `discussion_text` on 10 films including one generic title before any 200-film batch.**
- **`--with-reddit` rewrites already-good identities.** Target `_meta.sources == ["tmdb"]`; **never re-extract the whole catalogue in one pass** — affect vectors feed `_affect_vec` and the ranker.
- **Letterboxd import timeout** on 3,000-row diaries — cap rows/request and return "partial — re-upload to continue"; the dedupe makes re-upload safe by construction.
- **TMDB has no 429 handling** — Task 9's concurrency and Task 7's 30-title resolve both lean on it. If 429s appear, port `reddit.py`'s limiter into `tmdb.py`.

---

## Constraints honored

**Tasks 1–5:** No new model classes, libraries, or external APIs (xgboost/scipy/numpy/pickle already present). The 12-feature schema, 4-stage structure, and bandit segment/reward definitions are unchanged (feature build is *extracted*, not modified). Every trained model passes the Task 1 harness before going live; if it loses, no artifact ships and the fallback stays.

**Tasks 6–10:** The only new dependency is **none** — Reddit uses httpx, already present (explicitly *not* praw, which is sync). `IDENTITY_SCHEMA`, `_embedding_text`, and the 25-dim taste vector are unchanged — Reddit enriches the *prompt input*, never the output schema. `movie_identity.py` stays network-free (external text is a parameter), which structurally guarantees no external call can reach the request path. Letterboxd needs **no migration** and adds **no unique constraint** (same-day double-logging must stay legal in-app). No user-data table is dropped. `TastePreset` survives its dead endpoints.

## Verification
- **Task 1:** run `python -m scripts.eval_recs` from `backend/` (venv active, PG on 5433). Confirm it prints baseline vs candidate precision@10/take-rate/sample size, and shows the INSUFFICIENT-DATA banner on today's low volume. Add a tiny synthetic-slate unit check to confirm precision@k math (converted-in-top-10 counting).
- **Task 2/3:** run the train scripts; confirm the harness comparison prints and that no artifact is written when the model loses. Re-run `eval_recs` to confirm the shadow path is deterministic.
- **Task 4:** `GET /api/recommendations/for-you` for a heavy_rater vs new_user; confirm per-source score multipliers differ by segment (add a `pipeline` debug field or log). Cross-check against `GET /api/taste/bandit/weights`.
- **Task 5:** construct/seed a user with a recent taste shift so drift_score > 0.35; hit `/for-you` and confirm the explore split becomes 15/15 (50/50) and decay override applies for that request only; a low-drift user stays 21/9.
- Run the app end-to-end (`uvicorn app.main:app --reload --port 8000`) after Tasks 4–5 to confirm `/for-you` still returns 200 with 10 results/page and impressions still log.

### Tasks 6–10

- **Task 6 (deletions):** `grep -rn "taste-engine/query\|match-count\|taste-engine/presets\|taste-engine/options\|by-platform\|discover/awards" frontend/src backend/app` returns nothing. App boots; `curl -s localhost:8000/openapi.json | jq '.paths|keys'` shows `/api/taste-engine/similar` as the only `taste-engine` path. `cd frontend && npx tsc --noEmit && npm run build` — **the build is the real proof** the deleted components had no importers.
- **Task 7 (5-film answer):** `curl -s localhost:8000/api/taste-engine/similar -H 'content-type: application/json' -d '{"tmdbId":496243}' | jq '{n:(.answer|length), poolSize, hasMore, essence, first:.answer[0].explanation}'` → `n` is 4–5, `poolSize` 30, `hasMore` true, every `explanation` a readable ≤12-word line. Then `offset:5` → **disjoint** answer, `creatorRow: null`, and **sub-100ms** (proves the cache hit — no LLM). `offset:25` → `hasMore:false`. `languages:["ko","ja"]` → every `originalLanguage` in the set. `psql -p 5433 -c "select seed_tmdb_id, version, jsonb_array_length(payload->'results') from similar_cache limit 5"` → version 3, length 30. In-app: 5 rows with reasons, **no pagination bar anywhere**, "None of these fit" swaps instantly, refresh restores without refetch.
- **Task 8 (Home + For You):** DevTools Network on `/` → **3 content XHRs, not 9**; `<img>` count ≈24; no 60s `twins-now` poll. `curl -s 'localhost:8000/api/recommendations/for-you?page=2'` → `page:2`, 10 results, disjoint from page 1. In-app: `/for-you` renders, "Show more" appends pages 2 then 3 then the button disappears (`total` 30); Home shows 6 + "See all →". `/discover` redirects (not 404). Mobile nav shows Search **with an icon**, not a bare label. Change session mood → both surfaces refetch (proves the param moved into `queryFn`).
- **Task 9 (Letterboxd):** build a fixture `diary.csv` with — one film watched twice on different dates (`Rewatch=""` then `"Yes"`), one **2019** viewing, one unparseable `Watched Date`, one unresolvable title. `POST /api/import/letterboxd` with `diary=@fixture.csv`, then:
  - `select "movieId","watchedAt","isRewatch" from watch_log where "userId"='<id>' order by "watchedAt"` → **two rows** for the rewatched film, `isRewatch` false then true; the 2019 row stamped **2019** at 12:00 UTC (**not today**).
  - `select "watchedAt","completionPct" from watch_history where ...` → **one** summary row at the **later** date (proves `upsert_watch_summary`'s advance-only rule).
  - **`GET /api/wrapped/years` includes 2019** and `GET /api/wrapped/2019` is non-empty — *this is the headline check; it's the whole point of Task 9.*
  - `GET /api/diary` → both viewings, newest first. Unparseable → `skipped`; unresolvable → `unresolved`; **never a fabricated today-stamped row.**
  - **Re-POST the identical CSV** → `imported: 0`, all `skipped`, `count(*) from watch_log` unchanged. Append one new dated row, re-POST → exactly **+1**.
  - Import `diary` + `watchlist` together → watchlist rows **survive** (proves `clear_lifecycle` is correctly omitted).
  - A ~500-row fixture with heavy rewatches finishes materially faster than rows × TMDB latency (proves the memo).
- **Task 10 (Reddit):** `python -c "import asyncio; from app.integrations import reddit; print(asyncio.run(reddit.discussion_text('Parasite','2019','ko'))[:600])"` → real comparison sentences, no URLs, no `[deleted]`, ≤3200 chars. **With `REDDIT_CLIENT_ID=""` → returns `""` and the extractor still succeeds TMDB-only** (the graceful-skip check — this one must not fail). `--concurrency 4 --limit 20` and time it → ≥20s of Reddit wall-clock (1 req/s floor held), **zero 429s**. `select tmdb_id, month, version, payload->>'sentences' from reddit_cache limit 5` → current-month rows; re-run `enrich_reddit` → all cache hits, near-instant, no Reddit traffic. Then `extract_movie_identities --limit 5 --with-reddit` and diff one film's `identity_json` vs its pre-Reddit value: `comparable_by_feel` shifts toward the chatter's references, all 8 required fields present, `affect_axes` still 9 keys, `_meta.sources == ["tmdb","reddit"]`, `identity_embedding` non-null. **`grep -n "reddit" app/ml/llm/movie_identity.py` returns nothing** — the structural guarantee it can't run on the request path.
- **After all:** `uvicorn app.main:app --reload --port 8000` + `npm run dev`; walk Home → answer → For You → Diary → Wrapped, and confirm `/for-you` still returns 200 at 10/page and impressions still log.
