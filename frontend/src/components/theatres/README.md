# Theatres components — in-cinema showtimes for a film

This folder surfaces where and when a film is playing in the user's city, shown on the film detail page. It's the bridge from "I want to see this" to actually booking a seat.

## Components
- **`NowShowingSection.tsx`** — the "Now showing" block for a given film. Takes a city (a manual text input for now, until geolocation lands), fetches showtimes, groups them by theatre, and renders each theatre with its chain name and a row of clickable time chips that deep-link to the partner's booking URL. Reads `/api/now-showing/film/:tmdbId?city=`.

## Notes
Self-hiding: renders nothing while loading or when there are no showtimes, so it only appears when there's something bookable. Showtimes are grouped per theatre and formatted to local time. Time chips open the booking link in a new tab (`target="_blank"`) when one exists. Data is fed by an external partner; the UI is ready ahead of full geo/city detection. Compact and card-based to sit cleanly inside the film detail layout.
