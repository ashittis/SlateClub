# ml/llm — LLM-assisted taste understanding

The language-model layer: it describes taste in words, detects when taste is drifting,
balances exploration with a bandit, and extracts a film's "identity" (tone/style tags).

## Files
- **`openai_client.py`** — the shared LLM client wrapper (model config, calls, retries).
- **`taste_describer.py`** — turns a taste vector into human-readable descriptions
  ("slow-burn character studies with warm cinematography").
- **`taste_identity.py`** — derives a user's higher-level taste identity/persona.
- **`drift_detector.py`** — spots when a user's recent taste has shifted from their baseline,
  so recommendations can adapt.
- **`contextual_bandit.py`** — the explore/exploit policy: decides when to show safe picks
  vs. novel ones, learning from feedback.
- **`movie_identity.py`** — extracts tone/pacing/storytelling tags for a film (the
  mood-aware metadata the whole engine is built on).

## How it works
`movie_identity` enriches films with the tags that make mood-native recommendation possible;
`taste_describer`/`taste_identity` explain the *why* to users; `drift_detector` and
`contextual_bandit` keep recommendations adaptive rather than static. Called by
`features/recommendation` and `shared/services/watch_signals`.
