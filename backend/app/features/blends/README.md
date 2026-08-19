# blends — two people's taste, one list

"What should we watch together?"

## Built on the discovery engine

A blend reuses the Phase 8 pools rather than inventing a second recommendation
path:

1. Each member's highest-rated films become seeds.
2. Their warm evidence pools are pulled — the same ones the film page uses.
3. Candidates that surface for **more than one member** are kept; that overlap
   *is* the blend.
4. Anything any member has already seen is dropped.

So a blend recommendation is exactly as evidence-backed as any other, and there
is no separate model to keep honest.

## Access is the link

`invite_token` is the whole access model, and it's hidden from non-members.
Kaset's follow graph is one-directional, so there's no mutual-friends set to
invite from — a shareable link is what people actually do.

## Empty states are typed

`/recommendations` returns a `reason` (`waiting_for_members`, `no_warm_pools`,
`no_overlap`) rather than a bare empty list. The three causes need three
different messages, and the UI can't tell them apart from `[]`.

## What replaced Match Cut

SlateClub compared 25-dimensional taste vectors to produce a compatibility
percentage. That stack is gone; this needs no model at all.
