"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import CardStack from "@/components/ui/CardStack";
import Pill from "@/components/ui/Pill";
import ShelfNoteSheet, {
  type ShelfNotePayload,
} from "@/components/film/ShelfNoteSheet";
import { apiFetch, tmdbImage } from "@/lib/api";

gsap.registerPlugin(useGSAP);

export interface HeroFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  originalLanguage: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[] | null;
}

export interface HeroData {
  hero: HeroFilm | null;
  stack: { tmdbId: number; title: string; posterPath: string | null }[];
  explanation: string | null;
}

interface Props {
  data: HeroData;
}

type ActionKind = "dislike" | "shelf" | "watched";

// Each action exits the card in a distinct direction so a static cursor
// still produces an unmistakable, observable response.
const EXIT: Record<ActionKind, gsap.TweenVars> = {
  dislike: { x: -160, rotation: -8 },
  shelf: { y: -180, rotation: 0 },
  watched: { x: 160, rotation: 8 },
};
const LABEL: Record<ActionKind, string> = {
  dislike: "Dismissed",
  shelf: "Shelved",
  watched: "Watched",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function HeroFan({ data }: Props) {
  const qc = useQueryClient();
  const { hero, stack, explanation } = data;

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [shelfOpen, setShelfOpen] = useState(false);

  const advance = () => qc.invalidateQueries({ queryKey: ["hero-feed"] });

  const dislikeMut = useMutation({
    mutationFn: (tmdbId: number) =>
      apiFetch("/api/feedback/micro", {
        method: "POST",
        body: JSON.stringify({ movieId: tmdbId, type: "not_in_mood" }),
      }),
    onSuccess: advance,
  });

  const watchlistMut = useMutation({
    mutationFn: ({ tmdbId, payload }: { tmdbId: number; payload: ShelfNotePayload }) =>
      apiFetch(`/api/movies/${tmdbId}/watchlist`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: advance,
  });

  const watchedMut = useMutation({
    mutationFn: (tmdbId: number) =>
      apiFetch(`/api/movies/${tmdbId}/watched`, { method: "POST" }),
    onSuccess: advance,
  });

  // Scope for the action handlers (contextSafe keeps tweens in this context).
  const { contextSafe } = useGSAP({ scope: containerRef });

  // Enter animation — replays each time the hero film changes, and clears
  // any leftover exit transform / status label from the previous card.
  useGSAP(
    () => {
      if (!hero) return;
      setPending(null);
      const mm = gsap.matchMedia();
      gsap.set(overlayRef.current, { opacity: 0 });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          cardRef.current,
          { opacity: 0, y: 24, scale: 0.96, x: 0, rotation: 0 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            x: 0,
            rotation: 0,
            duration: 0.45,
            ease: "power2.out",
          }
        );
      });
    },
    { dependencies: [hero?.tmdbId], scope: containerRef }
  );

  const busy =
    pending !== null ||
    dislikeMut.isPending ||
    watchlistMut.isPending ||
    watchedMut.isPending;

  // Play the directional exit for `kind`, then run `fire` (the mutation).
  const playExit = contextSafe((kind: ActionKind, fire: () => void) => {
    setPending(LABEL[kind]);
    if (prefersReducedMotion()) {
      fire();
      return;
    }
    const tl = gsap.timeline({ onComplete: fire });
    tl.to(
      actionsRef.current,
      { scale: 0.95, duration: 0.09, yoyo: true, repeat: 1, ease: "power1.inOut" },
      0
    );
    tl.fromTo(
      overlayRef.current,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 0.25, ease: "back.out(2)" },
      0
    );
    tl.to(
      cardRef.current,
      { ...EXIT[kind], opacity: 0, scale: 0.9, duration: 0.38, ease: "power2.in" },
      0.05
    );
  });

  const handleAction = (kind: ActionKind) => {
    if (busy || !hero) return;
    // Shelf collects a note first; the sheet's submit drives the animation.
    if (kind === "shelf") {
      setShelfOpen(true);
      return;
    }
    const tmdbId = hero.tmdbId;
    playExit(kind, () =>
      kind === "dislike"
        ? dislikeMut.mutate(tmdbId)
        : watchedMut.mutate(tmdbId)
    );
  };

  const commitShelf = (payload: ShelfNotePayload) => {
    if (!hero) return;
    const tmdbId = hero.tmdbId;
    setShelfOpen(false);
    playExit("shelf", () => watchlistMut.mutate({ tmdbId, payload }));
  };

  if (!hero) return null;

  const heroPoster = hero.posterPath ? tmdbImage(hero.posterPath, "w500") : "";
  const stackPosters = stack
    .map((s) => (s.posterPath ? tmdbImage(s.posterPath, "w300") : ""))
    .filter(Boolean);

  // CardStack `fan` variant uses [left, right, focused] ordering.
  const posters = [
    stackPosters[0] || heroPoster,
    stackPosters[1] || heroPoster,
    heroPoster,
  ];

  const year = hero.releaseDate ? hero.releaseDate.slice(0, 4) : null;

  return (
    <div ref={containerRef}>
      <section className="relative flex flex-col items-center pb-6">
        <div ref={cardRef} className="flex flex-col items-center">
          <Link
            href={`/film/${hero.tmdbId}`}
            className="block"
            aria-label={`Open ${hero.title}`}
          >
            <CardStack posters={posters} variant="fan" size="md" alt={hero.title} />
          </Link>

          <div className="mt-5 text-center max-w-md px-4">
            <h2
              className="display text-2xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {hero.title}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {[
                year,
                hero.originalLanguage?.toUpperCase(),
                hero.runtime ? `${hero.runtime}m` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {hero.genres && hero.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {hero.genres.slice(0, 3).map((g) => (
                  <Pill key={g.id} kind="genre" interactive={false} size="sm">
                    {g.name}
                  </Pill>
                ))}
              </div>
            )}

            {explanation && (
              <p
                className="mt-3 text-xs italic"
                style={{ color: "var(--text-faint)" }}
              >
                {explanation}
              </p>
            )}
          </div>
        </div>

        {/* Status label — confirms the click while the card animates away.
            Always mounted (opacity-driven) so the exit timeline can target
            it without a render-timing race. */}
        <div
          ref={overlayRef}
          className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center opacity-0"
        >
          <span
            className="rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{
              background: "rgba(0,0,0,0.72)",
              color: "var(--text-primary)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {pending}
          </span>
        </div>

        <div ref={actionsRef} className="mt-5 flex items-center justify-center gap-3">
          <ActionButton
            label="Dislike"
            disabled={busy}
            onClick={() => handleAction("dislike")}
          />
          <ActionButton
            label="+ Shelf"
            primary
            disabled={busy}
            onClick={() => handleAction("shelf")}
          />
          <ActionButton
            label="✓ Watched"
            disabled={busy}
            onClick={() => handleAction("watched")}
          />
        </div>
      </section>

      <ShelfNoteSheet
        open={shelfOpen}
        title={hero.title}
        onClose={() => setShelfOpen(false)}
        onSubmit={commitShelf}
        pending={watchlistMut.isPending}
      />
    </div>
  );
}

function ActionButton({
  label,
  primary,
  disabled,
  onClick,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-full text-xs font-semibold transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: primary ? "var(--cta-primary)" : "var(--bg-elevated)",
        color: primary ? "var(--bg-screening)" : "var(--text-primary)",
        border: primary
          ? "1px solid transparent"
          : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {label}
    </button>
  );
}
