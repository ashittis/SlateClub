"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";

interface FavFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
}

interface FilmResult {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
}

const MAX_FAVORITES = 5;

/* ---------- View-mode poster tile ---------- */

function PosterTile({ film, index }: { film: FavFilm; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Link href={`/film/${film.tmdbId}`} className="group block">
        <div
          className="relative aspect-[2/3] overflow-hidden rounded-lg"
          style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {film.posterPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tmdbImage(film.posterPath, "w300")}
              alt={film.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px]" style={{ color: "var(--text-faint)" }}>
              {film.title}
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <p className="truncate text-[10px] font-medium text-white">{film.title}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* Empty "add a film" slot — opens the inline editor. */
function AddSlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex aspect-[2/3] items-center justify-center rounded-lg border border-dashed transition-colors hover:border-[var(--cta-primary)]"
      style={{ borderColor: "rgba(255,255,255,0.12)", background: "var(--bg-elevated)" }}
      aria-label="Add a favorite film"
    >
      <span className="text-2xl leading-none transition-colors group-hover:text-[var(--cta-primary)]" style={{ color: "var(--text-faint)" }}>
        +
      </span>
    </button>
  );
}

/* ---------- Edit-mode draggable tile ---------- */

function EditTile({ film, onRemove }: { film: FavFilm; onRemove: (id: number) => void }) {
  return (
    <Reorder.Item
      value={film}
      className="relative w-[19%] shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
      whileDrag={{ scale: 1.05, zIndex: 10 }}
    >
      <div
        className="aspect-[2/3] overflow-hidden rounded-lg"
        style={{ border: "2px solid var(--cta-primary)", boxShadow: "0 0 0 4px rgba(255,138,0,0.15)" }}
      >
        {film.posterPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tmdbImage(film.posterPath, "w300")} alt={film.title} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px]" style={{ background: "var(--bg-elevated)", color: "var(--text-faint)" }}>
            {film.title}
          </div>
        )}
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(film.tmdbId)}
        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: "var(--bg-screening)", border: "1.5px solid rgba(255,255,255,0.15)", color: "var(--text-muted)" }}
        aria-label={`Remove ${film.title}`}
      >
        ✕
      </button>
    </Reorder.Item>
  );
}

/* ---------- Section header ---------- */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between border-b border-glass-6 pb-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
        Favorite Films
      </h2>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

const actionCls = "text-xs font-medium transition-opacity hover:opacity-70";

/* ---------- Main component ---------- */

export default function FavoriteFilms() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<FavFilm[]>({
    queryKey: ["profile", "favorites"],
    queryFn: () => apiFetch<FavFilm[]>("/api/users/me/favorites"),
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FavFilm[]>([]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery<{ results: FilmResult[] }>({
    queryKey: ["fav-film-search", debounced],
    queryFn: () => apiFetch(`/api/movies/search?q=${encodeURIComponent(debounced)}`),
    enabled: editing && debounced.length >= 2,
    staleTime: 60_000,
  });

  const favorites = data ?? [];

  function startEdit() {
    setDraft(favorites);
    setError(null);
    setQuery("");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setDraft([]);
    setQuery("");
    setError(null);
  }

  function addFilm(f: FilmResult) {
    setDraft((prev) => {
      if (prev.length >= MAX_FAVORITES || prev.some((p) => p.tmdbId === f.id)) return prev;
      return [...prev, { tmdbId: f.id, title: f.title, posterPath: f.poster_path }];
    });
    setQuery("");
    setDropOpen(false);
  }

  function removeFilm(tmdbId: number) {
    setDraft((prev) => prev.filter((p) => p.tmdbId !== tmdbId));
  }

  async function save() {
    if (saving || draft.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/onboarding/movies", {
        method: "POST",
        body: JSON.stringify({
          movies: draft.map((f) => ({ tmdbId: f.tmdbId, title: f.title, posterPath: f.posterPath })),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["profile", "favorites"] });
      setEditing(false);
      setDraft([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your favorites");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- Loading ---------- */
  if (isLoading) {
    return (
      <div className="mb-8">
        <SectionHeader>{null}</SectionHeader>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {Array.from({ length: MAX_FAVORITES }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-glass-8" />
          ))}
        </div>
      </div>
    );
  }

  /* ---------- Edit mode ---------- */
  if (editing) {
    const canAddMore = draft.length < MAX_FAVORITES;
    return (
      <div className="mb-8">
        <SectionHeader>
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>{draft.length}/{MAX_FAVORITES}</span>
          <button type="button" onClick={cancel} className={actionCls} style={{ color: "var(--text-subtle)" }}>Cancel</button>
          <button
            type="button"
            onClick={save}
            disabled={saving || draft.length === 0}
            className={actionCls + " disabled:opacity-40"}
            style={{ color: "var(--cta-primary)" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </SectionHeader>

        {/* Search */}
        {canAddMore && (
          <div className="relative mb-4">
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setDropOpen(true); }}
              onFocus={() => setDropOpen(true)}
              onBlur={() => setTimeout(() => setDropOpen(false), 180)}
              placeholder="Search a film to add…"
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)" }}
            />
            <AnimatePresence>
              {dropOpen && debounced.length >= 2 && (results.data?.results?.length ?? 0) > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl"
                  style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7)" }}
                >
                  {(results.data?.results ?? []).slice(0, 7).map((f) => {
                    const already = draft.some((p) => p.tmdbId === f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addFilm(f)}
                        disabled={already}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-opacity hover:opacity-80 disabled:opacity-40"
                      >
                        <div className="h-12 w-8 shrink-0 overflow-hidden rounded-md" style={{ background: "var(--bg-elevated)" }}>
                          {f.poster_path && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={tmdbImage(f.poster_path, "w200")} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{f.title}</p>
                          {f.release_date && (
                            <p className="text-xs" style={{ color: "var(--text-faint)" }}>{f.release_date.slice(0, 4)}</p>
                          )}
                        </div>
                        {already && <span className="ml-auto shrink-0 text-xs" style={{ color: "var(--cta-primary)" }}>Added</span>}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Draggable picks */}
        {draft.length > 0 ? (
          <Reorder.Group axis="x" values={draft} onReorder={setDraft} className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:gap-3">
            {draft.map((f) => (
              <EditTile key={f.tmdbId} film={f} onRemove={removeFilm} />
            ))}
          </Reorder.Group>
        ) : (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-subtle)" }}>
            Search above to add your favourite films.
          </p>
        )}

        <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>Drag posters to reorder · up to {MAX_FAVORITES} films.</p>
        {error && <p className="mt-2 text-sm" style={{ color: "var(--signal-error)" }}>{error}</p>}
      </div>
    );
  }

  /* ---------- View mode ---------- */
  const emptySlots = Math.max(0, MAX_FAVORITES - favorites.length);
  return (
    <div className="mb-8">
      <SectionHeader>
        <button type="button" onClick={startEdit} className={actionCls} style={{ color: "var(--cta-primary)" }}>Edit</button>
      </SectionHeader>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {favorites.map((f, i) => <PosterTile key={f.tmdbId} film={f} index={i} />)}
        {Array.from({ length: emptySlots }).map((_, i) => <AddSlot key={`add-${i}`} onClick={startEdit} />)}
      </div>
      {favorites.length === 0 && (
        <p className="mt-3 text-sm" style={{ color: "var(--text-subtle)" }}>
          Pick the five films that define your taste.{" "}
          <button type="button" onClick={startEdit} className="font-medium" style={{ color: "var(--cta-primary)" }}>Add them →</button>
        </p>
      )}
    </div>
  );
}
