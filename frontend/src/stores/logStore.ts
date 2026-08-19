"use client";

import { create } from "zustand";

/**
 * The least a film has to be for the log surface to accept it.
 *
 * Deliberately looser than `FilmCard`: logging is opened from a search result,
 * a poster card, a full film detail and an activity event, and demanding the
 * exact `FilmCard` shape forced call sites to reconstruct objects they already
 * had. All the dialog does with this is show a poster and a title.
 */
export interface LogFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year?: string | null;
}

/**
 * The log surface, hoisted out of any one page.
 *
 * Logging is the centre of the loop, so it has to be reachable from wherever
 * you happen to be — the top bar, a film page, a poster's quick actions. Those
 * three call sites used to mean three implementations; this is the one dialog
 * they all drive.
 *
 * `film` is optional: opening without one starts at the film picker, opening
 * with one skips straight to the form.
 */
interface OpenLogOptions {
  film?: LogFilm;
  /** Set when the caller already knows the internal id, so the form skips a fetch. */
  filmId?: string;
  /** Defaults the rewatch toggle — the caller usually knows from film status. */
  isRewatch?: boolean;
  /**
   * Fires once the write lands. The dialog has no idea which queries the
   * *opening* surface cares about — the film page invalidates six, the top bar
   * none — so the caller supplies that, rather than the dialog guessing.
   */
  onLogged?: () => void;
}

interface LogState {
  open: boolean;
  film: LogFilm | null;
  filmId: string | null;
  isRewatch: boolean;
  onLogged: (() => void) | null;
  openLog: (opts?: OpenLogOptions) => void;
  closeLog: () => void;
}

export const useLogStore = create<LogState>((set) => ({
  open: false,
  film: null,
  filmId: null,
  isRewatch: false,
  onLogged: null,

  openLog: (opts) =>
    set({
      open: true,
      film: opts?.film ?? null,
      filmId: opts?.filmId ?? null,
      isRewatch: opts?.isRewatch ?? false,
      onLogged: opts?.onLogged ?? null,
    }),

  // Keep the film on close so the exit animation doesn't play against an empty
  // panel. The next open overwrites it anyway.
  closeLog: () => set({ open: false }),
}));
