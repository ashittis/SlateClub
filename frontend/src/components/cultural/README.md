# cultural components — cultural context around a film

Shows the "why this film matters" context: background and connections to other films/movements.

## Components
- **`CulturalContextCard.tsx`** — the card presenting a film's cultural context/background.
- **`ConnectorRail.tsx`** — a rail of connected films/themes (the "this leads to…" links).

## Notes
- The connector rail scrolls horizontally; cards fade/slide in with Framer Motion.
- Calls the `cultural` endpoint for a film.
