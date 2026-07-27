# watch_parties — synchronised group viewings

Scheduled or live "watch parties": a host picks a film, friends join, and everyone can
drop timed reactions during the viewing.

## Files
- **`routes.py`** — create a party, join/leave, and post reactions.
- **`models.py`** — `WatchParty` (the event), `WatchPartyParticipant` (who's in), and
  `WatchPartyReaction` (timestamped reactions during playback).

## How it works
1. A host creates a `WatchParty` for a film; invited users become `WatchPartyParticipant`s.
2. During the party, participants post `WatchPartyReaction`s tied to a playback timestamp,
   which the UI overlays on the film.

## Talks to
- shared models: `user`; own model: `watch_parties`
