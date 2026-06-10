"use client";

import { motion } from "framer-motion";
import type { SeasonSummary, SeriesMyRatings } from "@/types/series";

interface Props {
  seasons: SeasonSummary[];
  myRatings: SeriesMyRatings | undefined;
  overallRating: number | null;
  onRateOverall: (v: number) => void;
}

function StarBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="relative h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: "var(--cta-primary)" }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

export default function SeriesRatingSummary({ seasons, myRatings, overallRating, onRateOverall }: Props) {
  const ratedSeasons = seasons.filter((s) => {
    const r = myRatings?.seasons?.[String(s.seasonNumber)];
    return r != null && r > 0;
  });

  const seasonAvg = ratedSeasons.length > 0
    ? ratedSeasons.reduce((sum, s) => sum + (myRatings!.seasons[String(s.seasonNumber)] ?? 0), 0) / ratedSeasons.length
    : null;

  const episodeKeys = Object.keys(myRatings?.episodes ?? {});
  const ratedEpisodes = episodeKeys.length;
  const episodeAvg = ratedEpisodes > 0
    ? Object.values(myRatings!.episodes).reduce((a, b) => a + b, 0) / ratedEpisodes
    : null;

  if (!myRatings || (ratedSeasons.length === 0 && ratedEpisodes === 0)) {
    return (
      <p className="text-sm text-center py-4" style={{ color: "var(--text-faint)" }}>
        Rate individual seasons below to see your aggregated score.
      </p>
    );
  }

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-faint)" }}>
        Your Rating Summary
      </p>

      {/* Three scores in a row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Overall", value: overallRating, note: "series rating" },
          { label: "Season avg", value: seasonAvg ? Math.round(seasonAvg * 10) / 10 : null, note: `${ratedSeasons.length} rated` },
          { label: "Episode avg", value: episodeAvg ? Math.round(episodeAvg * 10) / 10 : null, note: `${ratedEpisodes} rated` },
        ].map(({ label, value, note }) => (
          <div key={label} className="text-center">
            <p className="text-2xl font-bold" style={{ color: value ? "var(--cta-primary)" : "var(--text-faint)" }}>
              {value != null ? value.toFixed(1) : "—"}
            </p>
            <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
            <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>{note}</p>
          </div>
        ))}
      </div>

      {/* Season breakdown bars */}
      {ratedSeasons.length > 0 && (
        <div className="space-y-2">
          {seasons.map((s) => {
            const r = myRatings?.seasons?.[String(s.seasonNumber)];
            const epKeys = Object.keys(myRatings?.episodes ?? {}).filter((k) => k.startsWith(`${s.seasonNumber}:`));
            if (!r) return null;
            return (
              <div key={s.seasonNumber} className="flex items-center gap-2">
                <span className="text-xs w-16 truncate shrink-0" style={{ color: "var(--text-faint)" }}>
                  S{s.seasonNumber}
                </span>
                <div className="flex-1">
                  <StarBar value={r} max={10} />
                </div>
                <span className="text-xs w-8 text-right shrink-0 font-medium" style={{ color: "var(--text-primary)" }}>
                  {r.toFixed(1)}
                </span>
                {epKeys.length > 0 && (
                  <span className="text-[10px] w-12 text-right shrink-0" style={{ color: "var(--text-faint)" }}>
                    {epKeys.length} eps
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
