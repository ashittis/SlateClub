"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";
import type { Movie } from "@/types/movie";
import Button from "@/components/ui/Button";
import StarRating from "@/components/ratings/StarRating";
import RecommendSheet from "@/components/film/RecommendSheet";
import ShelfNoteSheet, {
  type ShelfNotePayload,
} from "@/components/film/ShelfNoteSheet";
import DNFSheet, { type DnfPayload } from "@/components/film/DNFSheet";
import LogCompletionBurst from "@/components/film/LogCompletionBurst";
import AddToSlateSheet from "@/components/slates/AddToSlateSheet";
import { addRecentlyViewed } from "@/lib/searchHistory";
import FilmDiscussSection from "@/components/discourse/FilmDiscussSection";
import ConnectorRail from "@/components/cultural/ConnectorRail";
import CulturalContextCard from "@/components/cultural/CulturalContextCard";
import NowShowingSection from "@/components/theatres/NowShowingSection";
import ExpandableSynopsis from "@/components/film/ExpandableSynopsis";
import MoreLikeThisRow from "@/components/film/MoreLikeThisRow";
import CommunityConsensus from "@/components/discover/CommunityConsensus";

// TMDB two-letter language codes → display names for the meta line.
const LANG_NAMES: Record<string, string> = {
  en: "English", ta: "Tamil", hi: "Hindi", te: "Telugu", ml: "Malayalam",
  kn: "Kannada", ko: "Korean", ja: "Japanese", fr: "French", es: "Spanish",
  de: "German", it: "Italian", zh: "Chinese", pt: "Portuguese", ru: "Russian",
};
const langName = (code?: string | null) =>
  code ? LANG_NAMES[code] ?? code.toUpperCase() : null;

/* ---------- Film detail page ---------- */

interface UserMovieStatus {
  inWatchlist: boolean;
  shelf: { reasonType: string | null; reasonReference: string | null; note: string | null } | null;
  watching: { progressPct: number; startedAt: string } | null;
  watched: boolean;
  dnf: { reason: string | null; stoppedAt: string | null; progressPct: number | null } | null;
  rating: number | null;
  logCount: number;
  atTheatre: boolean;
  lastLoggedVisibility: "public" | "private";
}

interface WatchedPayload {
  atTheatre: boolean;
  isRewatch: boolean;
  visibility: "public" | "private";
}

export default function FilmDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [recOpen, setRecOpen] = useState(false);
  const [slateOpen, setSlateOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [dnfOpen, setDnfOpen] = useState(false);
  // Log-this-viewing controls (apply to the next Mark-Watched / rewatch log).
  const [atTheatre, setAtTheatre] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  // Completion celebration ("you did it" moment on rate / log).
  const [celebrate, setCelebrate] = useState<{ label: string } | null>(null);

  // Fetch movie details
  const {
    data: movie,
    isLoading,
    error,
  } = useQuery<Movie>({
    queryKey: ["movie", slug],
    queryFn: () => apiFetch<Movie>(`/api/movies/${slug}`),
    enabled: !!slug,
  });

  // Record for the search page's "Recently viewed".
  useEffect(() => {
    if (movie)
      addRecentlyViewed({
        tmdbId: movie.tmdbId,
        mediaType: "movie",
        title: movie.title,
        posterPath: movie.posterPath,
        year: movie.releaseDate?.slice(0, 4) ?? null,
      });
  }, [movie?.tmdbId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch user's status for this movie (watchlist, watched, rating)
  const { data: status } = useQuery<UserMovieStatus>({
    queryKey: ["movieStatus", slug],
    queryFn: () => apiFetch<UserMovieStatus>(`/api/movies/${slug}/status`),
    enabled: !!slug,
  });

  // Mutations
  // Keep the profile library tabs in sync after a status change.
  const refreshProfileTabs = () => {
    queryClient.invalidateQueries({ queryKey: ["movieStatus", slug] });
    queryClient.invalidateQueries({ queryKey: ["profile", "ratings"] });
    queryClient.invalidateQueries({ queryKey: ["profile", "watched"] });
    queryClient.invalidateQueries({ queryKey: ["profile", "diary"] });
    queryClient.invalidateQueries({ queryKey: ["profile", "watchlist"] });
    queryClient.invalidateQueries({ queryKey: ["profile", "dnf"] });
  };

  // Shelf: saving opens the note sheet (POST with reason/note); the toggle-off
  // path removes it directly.
  const shelfMutation = useMutation({
    mutationFn: (payload: ShelfNotePayload) =>
      apiFetch(`/api/movies/${slug}/watchlist`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setShelfOpen(false);
      refreshProfileTabs();
    },
  });

  const unshelfMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/movies/${slug}/watchlist`, { method: "DELETE" }),
    onSuccess: refreshProfileTabs,
  });

  // Log a viewing (first watch or a rewatch) with the current theatre/privacy
  // toggles. A separate un-watch path removes all viewings.
  const logWatchMutation = useMutation({
    mutationFn: (payload: WatchedPayload) =>
      apiFetch(`/api/movies/${slug}/watched`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_data, payload) => {
      setCelebrate({ label: payload.isRewatch ? "Rewatched" : "Logged" });
      setAtTheatre(false);
      setIsPrivate(false);
      refreshProfileTabs();
    },
  });

  const unwatchMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/movies/${slug}/watched`, { method: "DELETE" }),
    onSuccess: refreshProfileTabs,
  });

  const logViewing = (isRewatch: boolean) =>
    logWatchMutation.mutate({
      atTheatre,
      isRewatch,
      visibility: isPrivate ? "private" : "public",
    });

  const dnfMutation = useMutation({
    mutationFn: (payload: DnfPayload) =>
      apiFetch(`/api/movies/${slug}/dnf`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setDnfOpen(false);
      refreshProfileTabs();
    },
  });

  const ratingMutation = useMutation({
    mutationFn: (rating: number) =>
      apiFetch(`/api/movies/${slug}/rate`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      }),
    onSuccess: (_data, rating) => {
      if (rating > 0) setCelebrate({ label: "Rated" });
      refreshProfileTabs();
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-64 w-full bg-glass-8 sm:h-80" />
        <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
          <div className="h-8 w-2/3 rounded bg-glass-8" />
          <div className="h-4 w-1/3 rounded bg-glass-8" />
          <div className="h-20 w-full rounded bg-glass-8" />
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <p className="text-glass-40">
          {error instanceof Error ? error.message : "Movie not found"}
        </p>
      </div>
    );
  }

  const year = movie.releaseDate
    ? new Date(movie.releaseDate).getFullYear()
    : null;
  const director = movie.credits?.director;
  const directorName = director?.name;
  const runtimeDisplay = movie.runtime
    ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
    : null;

  return (
    <div>
      {/* Hero backdrop */}
      <div className="relative h-64 w-full overflow-hidden sm:h-80">
        {movie.backdropPath ? (
          <img
            src={tmdbImage(movie.backdropPath, "w780")}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-glass-8" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-3xl px-4 -mt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Title block */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              {movie.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-glass-40">
              {directorName && director?.id ? (
                <Link href={`/artists/${director.id}`} className="hover:underline">{directorName}</Link>
              ) : directorName ? (
                <span>{directorName}</span>
              ) : null}
              {directorName && year && <span aria-hidden="true">&middot;</span>}
              {year && <span>{year}</span>}
              {runtimeDisplay && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>{runtimeDisplay}</span>
                </>
              )}
              {langName(movie.originalLanguage) && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>{langName(movie.originalLanguage)}</span>
                </>
              )}
            </div>
          </div>

          {/* Genre chips */}
          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {movie.genres.map((genre) => (
                <span
                  key={genre.id}
                  className="rounded-full bg-glass-8 px-3 py-1 text-xs font-medium text-glass-55"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          {/* Rating widget */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-glass-55">Your Rating</p>
            <div className="flex items-center gap-3">
              <StarRating
                size="xl"
                value={status?.rating ?? 0}
                onChange={(rating) => ratingMutation.mutate(rating)}
              />
              {status?.rating ? (
                <span className="text-sm font-semibold" style={{ color: "#FF9408" }}>
                  {status.rating.toFixed(2).replace(/\.?0+$/, "")}
                </span>
              ) : null}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant={status?.inWatchlist ? "primary" : "secondary"}
              onClick={() =>
                status?.inWatchlist
                  ? unshelfMutation.mutate()
                  : setShelfOpen(true)
              }
              disabled={unshelfMutation.isPending}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z"
                  clipRule="evenodd"
                />
              </svg>
              {status?.inWatchlist ? "✓ Shelved" : "Shelf"}
            </Button>

            <div className="flex items-center gap-2">
              {status?.watched ? (
                <Button
                  variant="primary"
                  onClick={() => logViewing(true)}
                  disabled={logWatchMutation.isPending}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                  Log rewatch{status.logCount > 1 ? ` · ${status.logCount}×` : ""}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => logViewing(false)}
                  disabled={logWatchMutation.isPending}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                  Mark Watched
                </Button>
              )}

              {/* Theatre-visit toggle — applies to the next log. */}
              <LogToggle
                active={atTheatre}
                onClick={() => setAtTheatre((v) => !v)}
                label={atTheatre ? "Logged as a theatre visit" : "Watched in a theatre?"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M4 6h16a1 1 0 011 1v3a2 2 0 000 4v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3a2 2 0 000-4V7a1 1 0 011-1z" strokeLinejoin="round" />
                  <path d="M13 6v12" strokeDasharray="1.5 2.5" strokeLinecap="round" />
                </svg>
              </LogToggle>

              {/* Public/private toggle — applies to the next log. */}
              <LogToggle
                active={isPrivate}
                onClick={() => setIsPrivate((v) => !v)}
                label={isPrivate ? "Private — only you" : "Public"}
              >
                {isPrivate ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
                  </svg>
                )}
              </LogToggle>

              {status?.watched && (
                <button
                  type="button"
                  onClick={() => unwatchMutation.mutate()}
                  disabled={unwatchMutation.isPending}
                  className="text-xs transition-opacity hover:opacity-80"
                  style={{ color: "var(--text-faint)" }}
                >
                  Remove
                </button>
              )}
            </div>

            <Button variant="secondary" onClick={() => setSlateOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              </svg>
              Add to Slate
            </Button>

            <Button variant="secondary" onClick={() => setRecOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
              </svg>
              Recommend
            </Button>
          </div>

          {/* DNF — quiet affordance; once marked, shows the abandon state. */}
          <button
            type="button"
            onClick={() => setDnfOpen(true)}
            className="-mt-1 self-start text-xs transition-opacity hover:opacity-80 cursor-pointer"
            style={{ color: "var(--text-faint)" }}
          >
            {status?.dnf ? "Marked as didn’t finish · edit" : "Didn’t finish?"}
          </button>

          {movie && (
            <>
              <RecommendSheet
                open={recOpen}
                onClose={() => setRecOpen(false)}
                tmdbId={Number(slug)}
                title={movie.title}
              />
              <ShelfNoteSheet
                open={shelfOpen}
                title={movie.title}
                onClose={() => setShelfOpen(false)}
                onSubmit={(payload) => shelfMutation.mutate(payload)}
                pending={shelfMutation.isPending}
              />
              <DNFSheet
                open={dnfOpen}
                title={movie.title}
                onClose={() => setDnfOpen(false)}
                onSubmit={(payload) => dnfMutation.mutate(payload)}
                pending={dnfMutation.isPending}
              />
              <AddToSlateSheet
                open={slateOpen}
                onClose={() => setSlateOpen(false)}
                tmdbId={Number(slug)}
                mediaType="movie"
                title={movie.title}
              />
            </>
          )}

          {celebrate && (
            <LogCompletionBurst
              posterPath={movie.posterPath}
              label={celebrate.label}
              onDone={() => setCelebrate(null)}
            />
          )}

          {/* Overview */}
          {movie.overview && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-text-primary">Overview</h2>
              <ExpandableSynopsis text={movie.overview} />
            </div>
          )}

          {/* Cast (top 6) */}
          {movie.credits?.cast && movie.credits.cast.length > 0 && (
            <div className="space-y-3 pb-8">
              <h2 className="text-lg font-semibold text-text-primary">Cast</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {movie.credits.cast.slice(0, 6).map((member) => (
                  <Link
                    key={member.id}
                    href={`/artists/${member.id}`}
                    className="flex items-center gap-3 rounded-lg bg-glass-6 p-2 transition-colors hover:bg-glass-10 group"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-glass-8">
                      {member.profile_path ? (
                        <img
                          src={tmdbImage(member.profile_path, "w200")}
                          alt={member.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-glass-15">
                          {member.name[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary group-hover:underline">
                        {member.name}
                      </p>
                      <p className="truncate text-xs text-text-subtle">
                        {member.character}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {/* Micro-Feedback */}
          {movie.id && (
            <div className="space-y-2 border-t border-glass-6 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">Quick feedback</p>
              <div className="flex flex-wrap gap-2">
                {(["not_in_mood", "too_slow", "seen_similar", "more_like_this"] as const).map((type) => {
                  const labels: Record<string, string> = {
                    not_in_mood: "Not in the mood",
                    too_slow: "Too slow",
                    seen_similar: "Seen similar",
                    more_like_this: "More like this",
                  };
                  return (
                    <button
                      key={type}
                      onClick={async () => {
                        const { apiFetch: af } = await import("@/lib/api");
                        await af("/api/feedback/micro", {
                          method: "POST",
                          body: JSON.stringify({ movieId: movie.id, type }),
                        });
                      }}
                      className="rounded-full border border-glass-6 px-3 py-1 text-xs text-glass-40 transition-colors hover:border-accent-green hover:text-accent-green/80"
                    >
                      {labels[type]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Community consensus — web-sourced "what to watch next", personalized */}
          {movie.tmdbId && <CommunityConsensus tmdbId={movie.tmdbId} />}

          {/* Cultural context (optional pre-watch card) */}
          {movie.tmdbId && <CulturalContextCard tmdbId={movie.tmdbId} />}

          {/* Connector — threads via shared crew */}
          {movie.tmdbId && <ConnectorRail tmdbId={movie.tmdbId} />}

          {/* More like this — taste-engine similarity rail */}
          {movie.tmdbId && (
            <MoreLikeThisRow tmdbId={movie.tmdbId} mediaType={movie.mediaType} />
          )}

          {/* Now showing — theatre listings (renders only when data exists) */}
          {movie.tmdbId && <NowShowingSection tmdbId={movie.tmdbId} />}

          {/* Discuss — Hot Takes + Polls scoped to this film */}
          {movie.tmdbId && <FilmDiscussSection tmdbId={movie.tmdbId} />}

          {/* Reviews Section */}
          {movie.id && <ReviewsSection movieId={movie.id} />}
        </motion.div>
      </div>
    </div>
  );
}

/* ---------- Log toggle (theatre / privacy) ---------- */

function LogToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border transition-colors"
      style={{
        borderColor: active ? "var(--cta-primary, #FF9408)" : "rgba(255,255,255,0.08)",
        color: active ? "var(--cta-primary, #FF9408)" : "var(--text-faint)",
        background: active ? "rgba(255,148,8,0.12)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

/* ---------- Reviews Section (inline) ---------- */

type ReviewSort = "helpful" | "recent";

function ReviewsSection({ movieId }: { movieId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sort, setSort] = useState<ReviewSort>("helpful");
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["reviews", movieId, sort],
    queryFn: () =>
      apiFetch<{
        reviews: {
          id: string;
          body: string;
          spoiler: boolean;
          helpfulCount: number;
          createdAt: string;
          user: { id: string; name: string; username: string };
          _count: { comments: number };
        }[];
      }>(`/api/reviews/movie/${movieId}?sort=${sort}`),
  });

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/reviews", {
        method: "POST",
        body: JSON.stringify({ movieId, body, spoiler }),
      });
      setBody("");
      setSpoiler(false);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["reviews", movieId] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-glass-6 pt-4 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Reviews</h2>
          <div className="flex gap-1">
            {(["helpful", "recent"] as ReviewSort[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize transition-colors"
                style={{
                  background: sort === s ? "var(--bg-elevated)" : "transparent",
                  color: sort === s ? "var(--text-primary)" : "var(--text-faint)",
                }}
              >
                {s === "helpful" ? "Top" : "Recent"}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm text-accent-green hover:text-accent-green/80"
        >
          {showForm ? "Cancel" : "Write a review"}
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-lg bg-glass-6 p-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            placeholder="What did you think?"
            rows={3}
            className="w-full resize-none rounded bg-glass-8 p-2 text-sm text-text-primary placeholder:text-glass-15 focus:outline-none focus:ring-1 focus:ring-accent-green"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-glass-40">
              <input
                type="checkbox"
                checked={spoiler}
                onChange={(e) => setSpoiler(e.target.checked)}
                className="rounded"
              />
              Contains spoilers
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-subtle">{body.length}/500</span>
              <button
                onClick={handleSubmit}
                disabled={submitting || !body.trim()}
                className="rounded-lg bg-accent-green px-3 py-1 text-xs font-medium text-bg-primary disabled:opacity-50"
              >
                {submitting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {data?.reviews && data.reviews.length > 0 ? (
        <div className="space-y-2">
          {data.reviews.map((review) => (
            <div key={review.id} className="rounded-lg bg-glass-6 p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-green/80 text-xs font-bold">
                  {review.user.name[0]}
                </div>
                <span className="text-sm font-medium text-text-primary">@{review.user.username}</span>
                <span className="text-xs text-text-subtle">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className={`text-sm text-glass-55 ${review.spoiler ? "blur-sm hover:blur-none transition-all cursor-pointer" : ""}`}>
                {review.body}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                <button
                  onClick={() =>
                    apiFetch(`/api/reviews/${review.id}/helpful`, { method: "POST" }).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["reviews", movieId] })
                    )
                  }
                  className="px-2 py-1 rounded-full"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-muted)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  Helpful ({review.helpfulCount})
                </button>
                <button
                  onClick={() =>
                    apiFetch(`/api/reviews/${review.id}/vote`, {
                      method: "POST",
                      body: JSON.stringify({ kind: "agree" }),
                    }).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["reviews", movieId] })
                    )
                  }
                  className="px-2 py-1 rounded-full"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--cta-primary)",
                    border: "1px solid rgba(255, 138, 0, 0.25)",
                  }}
                >
                  Agree
                </button>
                <button
                  onClick={() =>
                    apiFetch(`/api/reviews/${review.id}/vote`, {
                      method: "POST",
                      body: JSON.stringify({ kind: "disagree" }),
                    }).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["reviews", movieId] })
                    )
                  }
                  className="px-2 py-1 rounded-full"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--nav-active)",
                    border: "1px solid rgba(196,113,110,0.25)",
                  }}
                >
                  Disagree
                </button>
                <span style={{ color: "var(--text-faint)" }}>
                  {review._count.comments} comments
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-subtle">No reviews yet. Be the first!</p>
      )}
    </div>
  );
}
