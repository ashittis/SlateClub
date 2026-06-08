"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { tmdbImage } from "@/lib/api";
import type { FilmCardLite, TasteMatch } from "@/types/user";

interface Props {
  match: TasteMatch;
  targetUsername: string;
  targetName: string;
}

/*
  TasteMatchCard — the "Match Cut" between two people's taste vectors.
  Richer than the compact TwinBadge: the cosine %, the films you both
  love, and the ones you'd argue about. Borrows TwinBadge's green-glow
  treatment for strong matches (≥70%).
*/
export default function TasteMatchCard({ match, targetUsername, targetName }: Props) {
  const pct = Math.round(match.score * 100);
  const strong = pct >= 70;
  const firstName = targetName.split(" ")[0] || targetName;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8 rounded-2xl p-5"
      style={{
        background: "var(--bg-card)",
        border: strong
          ? "1px solid rgba(255, 138, 0, 0.45)"
          : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-base font-bold display"
            style={{
              background: strong ? "var(--cta-primary)" : "var(--bg-elevated)",
              color: strong ? "var(--bg-screening)" : "var(--text-primary)",
            }}
          >
            {pct}%
          </span>
          <div>
            <p className="display text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Match Cut
            </p>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              {strong
                ? `You and ${firstName} are on the same wavelength`
                : `Where your taste meets ${firstName}'s`}
            </p>
          </div>
        </div>
        <Link
          href={`/match-cut?with=${targetUsername}`}
          className="hidden shrink-0 rounded-full px-3 py-2 text-xs font-medium sm:inline-block"
          style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
        >
          Plan a movie night →
        </Link>
      </div>

      {match.sharedFavorites.length > 0 && (
        <PosterRow label="You both love" films={match.sharedFavorites} accent="var(--cta-primary)" />
      )}
      {match.disagreements.length > 0 && (
        <PosterRow label="You'd disagree on" films={match.disagreements} accent="var(--nav-active)" />
      )}

      <Link
        href={`/match-cut?with=${targetUsername}`}
        className="mt-4 block rounded-full px-3 py-2.5 text-center text-sm font-medium sm:hidden"
        style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}
      >
        Plan a movie night →
      </Link>
    </motion.section>
  );
}

function PosterRow({
  label,
  films,
  accent,
}: {
  label: string;
  films: FilmCardLite[];
  accent: string;
}) {
  return (
    <div className="mt-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        {label}
      </p>
      <div className="flex gap-2">
        {films.map((m) => (
          <Link
            key={m.tmdbId}
            href={`/film/${m.tmdbId}`}
            className="w-12 shrink-0"
            title={m.title}
          >
            <div
              className="aspect-[2/3] overflow-hidden rounded-md"
              style={{ background: "var(--bg-elevated)" }}
            >
              {m.posterPath && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={tmdbImage(m.posterPath, "w200")}
                  alt={m.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
