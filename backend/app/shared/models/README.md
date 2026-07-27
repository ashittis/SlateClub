# shared/models — the tables everything depends on

These are the SQLAlchemy tables imported by **many** features, so they live in one shared
place instead of any single slice. Splitting them would force every feature to cross-import.

## Files & tables
- **`user.py`** — `User`, `UserPreferences`, `UserTasteState`. *Imported by ~41 files* —
  the account, its settings, and its current taste state (vector + drift bookkeeping).
- **`actions.py`** — `Rating`, `WatchlistItem`, `WatchHistory`, `DiaryEntry`,
  `CurrentlyWatching`, `DnfEntry`, `Review`, `SeasonRating`, `EpisodeRating`,
  `EpisodeReaction`, `Comment`. *Imported by ~26 files* — every way a user acts on a film.
- **`movie.py`** — `Movie`. *Imported by ~25 files* — the canonical film row (mirrored from
  TMDB). Resolved/created via `features/movies._get_or_fetch_movie`.
- **`social.py`** — `Follow`, `OrbitRequest`, `ActivityEvent`, `MicroFeedback`,
  `Impression`, `CalibrationResponse`. *Imported by ~15 files* — the social graph plus the
  feedback/impression signals the ranker learns from.
- **`onboarding.py`** — `LanguageSelection`, `FavoritePerson`, `FavoriteMovie`,
  `OnboardingSignals`. *Imported by ~8 files* — cold-start taste seeds.
- **`similar_cache.py`** — `SimilarCache` — cached "similar films" results.
- **`reddit_cache.py`** — `RedditCache` — cached Reddit discussion enrichment.

## Why these are shared (and the rest aren't)
Feature-specific tables (a slate, a match-cut, a festival) live inside their feature slice
because only that feature touches them. The tables above are the connective tissue of the
product — the user, the films, the actions on films, and the social graph — so they're
common. Every model here is registered in `app/models_registry.py`.
