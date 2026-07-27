# ml/eval — offline evaluation

Tools to measure recommendation quality offline, without touching production — run these
after retraining to check a model actually got better.

## Files
- **`harness.py`** — the evaluation harness: replays held-out user history through the
  pipeline/ranker and computes ranking metrics (e.g. precision@k / NDCG).
- **`feature_reconstruction.py`** — rebuilds the feature vectors a model was trained on, so
  offline eval sees the same inputs as training (avoids train/serve skew).

## How it works
Run via `backend/scripts/eval_recs.py`. Load a trained model, reconstruct features for a
held-out set, score, and report metrics. Used to gate whether a newly trained ALS/XGBoost
model should be promoted.
