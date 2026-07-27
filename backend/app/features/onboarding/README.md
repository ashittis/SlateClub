# onboarding — the first-run taste calibration

The multi-step flow that seeds a brand-new user's taste: languages, favourite people,
favourite movies, mood, platforms, and origin. Its output is the cold-start signal the
recommendation engine reads before the user has rated anything.

## Files
- **`routes.py`** — endpoints for each onboarding step; validates and stores the choices,
  searching TMDB for people/films the user picks.

## How it works
1. Each step writes to a table in `shared/models/onboarding` (`LanguageSelection`,
   `FavoritePerson`, `FavoriteMovie`, `OnboardingSignals`).
2. `discovery` and `recommendation` read these signals to build a first feed for users who
   have no ratings yet.

## Talks to
- shared models: `onboarding`, `user`
- external: TMDB (searching people/films during the flow)
