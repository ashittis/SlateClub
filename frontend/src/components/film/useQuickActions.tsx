"use client";

import { useCallback, useState } from "react";
import QuickActions from "./QuickActions";
import type { FilmCardFilm } from "./FilmCard";

/**
 * Wires the quick-actions sheet into any screen showing poster cards.
 *
 * Returns the handler to hand to `FilmCard` plus the sheet to render. Keeping
 * it in a hook means every surface gets the same behaviour without each one
 * re-implementing open/close state.
 */
export function useQuickActions() {
  const [film, setFilm] = useState<FilmCardFilm | null>(null);
  const open = useCallback((f: FilmCardFilm) => setFilm(f), []);
  const close = useCallback(() => setFilm(null), []);

  const sheet = film ? <QuickActions film={film} onClose={close} /> : null;
  return { open, sheet };
}
