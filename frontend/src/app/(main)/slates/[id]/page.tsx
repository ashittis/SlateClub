"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { titleHref } from "@/lib/titleHref";
import SlateRoom from "@/components/slates/SlateRoom";
import type { SlateDetail, SlateFilm } from "@/types/slates";

gsap.registerPlugin(useGSAP);

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SlateDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const heroRef = useRef<HTMLDivElement>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [order, setOrder] = useState<SlateFilm[]>([]);

  const { data, isLoading } = useQuery<SlateDetail>({
    queryKey: ["slate", id],
    queryFn: () => apiFetch(`/api/slates/${id}`),
  });

  // Mirror server order into local state for drag-reorder.
  useEffect(() => {
    if (data?.films) setOrder(data.films);
  }, [data?.films]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["slate", id] });

  const saveMut = useMutation({
    mutationFn: (saved: boolean) =>
      apiFetch(`/api/slates/${id}/save`, { method: saved ? "DELETE" : "POST" }),
    onSuccess: invalidate,
  });
  const likeMut = useMutation({
    mutationFn: (liked: boolean) =>
      apiFetch(`/api/slates/${id}/like`, { method: liked ? "DELETE" : "POST" }),
    onSuccess: invalidate,
  });
  const removeFilmMut = useMutation({
    mutationFn: (f: SlateFilm) =>
      apiFetch(`/api/slates/${id}/films/${f.tmdbId}?mediaType=${f.mediaType}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });
  const addFilmMut = useMutation({
    mutationFn: (tmdbId: number) =>
      apiFetch(`/api/slates/${id}/films`, {
        method: "POST",
        body: JSON.stringify({ tmdbId, mediaType: "movie" }),
      }),
    onSuccess: () => {
      invalidate();
      setFilmSearch("");
      setFilmDebounced("");
    },
  });
  const reorderMut = useMutation({
    mutationFn: (items: SlateFilm[]) =>
      apiFetch(`/api/slates/${id}/films/reorder`, {
        method: "PATCH",
        body: JSON.stringify({
          items: items.map((f) => ({ tmdbId: f.tmdbId, mediaType: f.mediaType })),
        }),
      }),
    onSuccess: invalidate,
  });

  const [filmSearchOpen, setFilmSearchOpen] = useState(false);
  const [filmSearch, setFilmSearch] = useState("");
  const [filmDebounced, setFilmDebounced] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFilmDebounced(filmSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [filmSearch]);

  const filmResults = useQuery<{
    results: { id: number; title: string; poster_path: string | null; release_date: string | null }[];
  }>({
    queryKey: ["film-search", filmDebounced],
    queryFn: () => apiFetch(`/api/movies/search?q=${encodeURIComponent(filmDebounced)}`),
    enabled: filmDebounced.length >= 2,
    staleTime: 60_000,
  });

  useGSAP(
    () => {
      if (!data) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(heroRef.current, { opacity: 0, y: 18, duration: 0.5, ease: "power2.out" });
      });
    },
    { dependencies: [data?.id], scope: heroRef },
  );

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-24">
        <div className="h-48 rounded-2xl animate-pulse" style={{ background: "var(--bg-card)" }} />
      </div>
    );
  }

  const canEdit = data.canEdit;
  const isCreator = user?.id === data.creator?.id;
  const movieCount = data.films.filter((f) => f.mediaType !== "tv").length;
  const seriesCount = data.films.filter((f) => f.mediaType === "tv").length;
  const heroPoster = data.coverPosters?.[0];

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 pb-24">
      {/* ── Hero ── */}
      <div ref={heroRef} className="relative overflow-hidden rounded-3xl mb-8">
        {heroPoster && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={tmdbImage(heroPoster, "w780")}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30 blur-2xl scale-110"
            aria-hidden
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, var(--bg-screening) 10%, rgba(0,0,0,0.45))" }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:p-8">
          <div className="grid h-40 w-28 shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-xl shadow-2xl">
            {(data.coverPosters.length ? data.coverPosters : [null, null, null, null])
              .slice(0, 4)
              .map((p, i) => (
                <div key={i} style={{ background: "var(--bg-elevated)" }}>
                  {p && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={tmdbImage(p, "w200")} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--cta-primary)" }}>
              {data.visibility === "public" ? "Slate" : "Private Slate"}
            </p>
            <h1 className="display mt-1 text-3xl font-bold tracking-tight lg:text-5xl" style={{ color: "var(--text-primary)" }}>
              {data.title}
            </h1>
            {data.description && (
              <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
                {data.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "var(--text-faint)" }}>
              <span style={{ color: "var(--text-muted)" }}>{data.creator?.name ?? "—"}</span>
              {/* collaborator avatars */}
              {data.collaborators.length > 0 && (
                <span className="flex items-center -space-x-2 pl-1">
                  {data.collaborators.slice(0, 4).map((c) => (
                    <span
                      key={c.id}
                      title={c.name}
                      className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ring-2"
                      style={{ background: "var(--cta-primary)", color: "var(--bg-screening)", boxShadow: "0 0 0 2px var(--bg-screening)" }}
                    >
                      {c.avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={c.avatarUrl} alt={c.name} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        c.name[0]?.toUpperCase()
                      )}
                    </span>
                  ))}
                </span>
              )}
              <span>· {movieCount} Movies · {seriesCount} Series · ♥ {data.likeCount} · ⤓ {data.saveCount}</span>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => likeMut.mutate(data.likedByMe)}
                className="rounded-full px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 cursor-pointer"
                style={{
                  background: data.likedByMe ? "rgba(255,138,0,0.15)" : "var(--bg-elevated)",
                  color: data.likedByMe ? "var(--cta-primary)" : "var(--text-primary)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {data.likedByMe ? "♥ Liked" : "♡ Like"}
              </button>
              {!isCreator && user && (
                <button
                  onClick={() => saveMut.mutate(data.savedByMe)}
                  className="rounded-full px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 cursor-pointer"
                  style={{
                    background: data.savedByMe ? "var(--bg-elevated)" : "var(--cta-primary)",
                    color: data.savedByMe ? "var(--text-primary)" : "var(--bg-screening)",
                    border: data.savedByMe ? "1px solid rgba(255,255,255,0.08)" : "none",
                  }}
                >
                  {data.savedByMe ? "✓ Saved" : "Save Slate"}
                </button>
              )}
              <button
                onClick={() => navigator.share?.({ url: window.location.href })}
                className="rounded-full px-4 py-2 text-xs font-semibold cursor-pointer"
                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Share
              </button>
              {isCreator && (
                <Link
                  href={`/slates/${id}/settings`}
                  className="rounded-full px-4 py-2 text-xs font-semibold cursor-pointer"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Collaborate
                </Link>
              )}
              <button
                onClick={() => setRoomOpen((v) => !v)}
                className="rounded-full px-4 py-2 text-xs font-semibold lg:hidden cursor-pointer"
                style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {roomOpen ? "Hide Room" : "Slate Room"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
        <div>
          {/* Add a title (editors) */}
          {canEdit && (
            <div className="mb-4">
              <button
                onClick={() => setFilmSearchOpen((v) => !v)}
                className="rounded-full px-4 py-2 text-xs font-semibold cursor-pointer"
                style={{
                  background: filmSearchOpen ? "var(--cta-primary)" : "var(--bg-elevated)",
                  color: filmSearchOpen ? "var(--bg-screening)" : "var(--text-primary)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                + Add a film
              </button>
              <AnimatePresence>
                {filmSearchOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 overflow-visible"
                  >
                    <div className="relative">
                      <input
                        type="text"
                        value={filmSearch}
                        onChange={(e) => setFilmSearch(e.target.value)}
                        onFocus={() => setDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setDropdownOpen(false), 180)}
                        placeholder="Search a film to add… (use Add to Slate on a series page for series)"
                        className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                        style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-primary)" }}
                      />
                      <AnimatePresence>
                        {dropdownOpen && filmDebounced.length >= 2 && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 right-0 z-30 mt-2 rounded-xl overflow-hidden"
                            style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7)" }}
                          >
                            {(filmResults.data?.results ?? []).slice(0, 6).map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => addFilmMut.mutate(m.id)}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:opacity-80 cursor-pointer"
                              >
                                <div className="w-9 aspect-[2/3] rounded shrink-0 overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                                  {m.poster_path && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={tmdbImage(m.poster_path, "w200")} alt={m.title} className="w-full h-full object-cover" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{m.title}</p>
                                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>{m.release_date?.slice(0, 4) ?? ""}</p>
                                </div>
                                <span className="text-xs font-semibold" style={{ color: "var(--cta-primary)" }}>Add</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {data.films.length === 0 ? (
            <p className="text-sm rounded-xl p-6 text-center" style={{ color: "var(--text-faint)", background: "var(--bg-card)", border: "1px dashed rgba(255,255,255,0.06)" }}>
              No titles yet.
            </p>
          ) : canEdit ? (
            /* Editors: drag-reorder playlist (persists on drop). */
            <Reorder.Group
              axis="y"
              values={order}
              onReorder={setOrder}
              className="space-y-2"
            >
              {order.map((f, i) => (
                <Reorder.Item
                  key={`${f.mediaType}-${f.tmdbId}`}
                  value={f}
                  onDragEnd={() => reorderMut.mutate(order)}
                  className="flex items-center gap-3 rounded-xl p-2 cursor-grab active:cursor-grabbing"
                  style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span className="w-6 text-center text-sm font-bold" style={{ color: "var(--text-faint)" }}>{i + 1}</span>
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded" style={{ background: "var(--bg-elevated)" }}>
                    {f.posterPath && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={tmdbImage(f.posterPath, "w200")} alt={f.title ?? ""} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {f.title ?? `#${f.tmdbId}`}
                      {f.mediaType === "tv" && <span className="ml-1.5 text-[10px]" style={{ color: "var(--text-faint)" }}>SERIES</span>}
                    </p>
                    {f.note && <p className="truncate text-xs italic" style={{ color: "var(--text-faint)" }}>{f.note}</p>}
                  </div>
                  <button
                    onClick={() => removeFilmMut.mutate(f)}
                    className="px-2 text-sm cursor-pointer"
                    style={{ color: "var(--text-faint)" }}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            /* Viewers: numbered poster grid. */
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5">
              {data.films.map((f, i) => (
                <Link key={`${f.mediaType}-${f.tmdbId}`} href={titleHref(f.tmdbId, f.mediaType)} className="group block">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                    {f.posterPath && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={tmdbImage(f.posterPath, "w300")} alt={f.title ?? ""} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                    )}
                    <span className="absolute left-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold" style={{ background: "rgba(10,10,11,0.8)", color: "var(--cta-primary)" }}>
                      {i + 1}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs" style={{ color: "var(--text-primary)" }}>{f.title ?? `#${f.tmdbId}`}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <SlateRoom slateId={id} />
        </aside>
      </div>

      {/* Mobile Slate Room — bottom sheet. */}
      <AnimatePresence>
        {roomOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRoomOpen(false)}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: "rgba(0,0,0,0.55)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="fixed inset-x-0 bottom-0 z-50 lg:hidden h-[80vh]"
            >
              <SlateRoom slateId={id} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
