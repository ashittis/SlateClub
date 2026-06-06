"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Pill from "@/components/ui/Pill";
import ReleaseCarousel from "@/components/releases/ReleaseCarousel";
import ReleaseCalendar from "@/components/releases/ReleaseCalendar";
import type { CalendarResponse, ReleaseFilm } from "@/components/releases/types";

type Category = "upcoming" | "biggies";
type Range = "week" | "month";

function daysUntil(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

export default function ReleasesPage() {
  const cal = useQuery<CalendarResponse>({
    queryKey: ["releases-calendar"],
    queryFn: () => apiFetch("/api/releases/calendar"),
  });

  const [category, setCategory] = useState<Category>("upcoming");
  const [range, setRange] = useState<Range>("week");

  const allFilms: ReleaseFilm[] = useMemo(
    () => (cal.data?.days ?? []).flatMap((d) => d.films),
    [cal.data],
  );

  // Derive the panel set client-side — instant toggles, no refetch.
  const panel = useMemo(() => {
    const horizon = range === "week" ? 7 : 31;
    const within = allFilms.filter((f) => {
      const du = daysUntil(f.releaseDate);
      return du >= 0 && du <= horizon;
    });
    const sorted =
      category === "biggies"
        ? [...within].sort((a, b) => b.popularity - a.popularity)
        : [...within].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
    // De-dupe by tmdbId (a film can appear via multiple discover passes).
    const seen = new Set<number>();
    return sorted.filter((f) =>
      seen.has(f.tmdbId) ? false : (seen.add(f.tmdbId), true),
    ).slice(0, 15);
  }, [allFilms, category, range]);

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        Releases
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        What&apos;s hitting screens — across every language.
      </p>

      {/* Panel — Upcoming/Biggies × Week/Month toggles + CoverFlow carousel */}
      <div
        className="rounded-2xl p-4 lg:p-5"
        style={{
          background: "rgba(17,17,20,0.6)",
          border: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <ToggleGroup
            options={[
              { key: "upcoming", label: "Upcoming Movies" },
              { key: "biggies", label: "Biggies" },
            ]}
            value={category}
            onChange={(v) => setCategory(v as Category)}
          />
          <ToggleGroup
            options={[
              { key: "week", label: "This Week" },
              { key: "month", label: "This Month" },
            ]}
            value={range}
            onChange={(v) => setRange(v as Range)}
          />
        </div>

        {cal.isLoading ? (
          <div
            className="mt-4 h-[440px] rounded-2xl animate-pulse"
            style={{ background: "var(--bg-card)" }}
          />
        ) : (
          <ReleaseCarousel films={panel} />
        )}
      </div>

      {/* Calendar */}
      <div className="mt-10">
        {cal.isLoading ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            Loading calendar…
          </p>
        ) : (
          <ReleaseCalendar days={cal.data?.days ?? []} />
        )}
      </div>
    </div>
  );
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {options.map((o) => (
        <Pill
          key={o.key}
          kind="genre"
          size="md"
          active={value === o.key}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </Pill>
      ))}
    </div>
  );
}
