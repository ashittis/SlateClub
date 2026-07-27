"""Offline evaluation harness for the recommendation ranker.

Nothing here runs on the request path. It reconstructs point-in-time features
from logged impressions and compares a candidate scoring function against the
order actually served — the gate every trained model must pass before shipping.
"""
