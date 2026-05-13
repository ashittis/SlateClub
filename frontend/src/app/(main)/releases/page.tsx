"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";
import Pill from "@/components/ui/Pill";

interface ReleaseItem {
  id: string;
  tmdbId: number;
  title: string | null;
  posterPath: string | null;
  platform: string;
  releaseDate: string;
  daysUntil: number;
}

export default function ReleasesPage() {
  const list = useQuery<{ items: ReleaseItem[] }>({
    queryKey: ["releases-upcoming"],
    queryFn: () => apiFetch("/api/releases/upcoming?days=60"),
  });

  // Group by date for the calendar feel
  const byDate = (list.data?.items ?? []).reduce<Record<string, ReleaseItem[]>>(
    (acc, r) => {
      const key = r.releaseDate.slice(0, 10);
      (acc[key] ||= []).push(r);
      return acc;
    },
    {},
  );

  const dateKeys = Object.keys(byDate).sort();

  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        Releases
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        What&apos;s coming to theatres and streaming, next 60 days.
      </p>

      {list.isLoading && (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Loading…
        </p>
      )}

      {!list.isLoading && dateKeys.length === 0 && (
        <p
          className="text-sm rounded-xl p-6 text-center"
          style={{
            color: "var(--text-faint)",
            background: "var(--bg-card)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          No upcoming releases tracked yet. Once the TMDB ingest job runs,
          this fills with theatre + OTT drops in your region.
        </p>
      )}

      <div className="space-y-6">
        {dateKeys.map((dateKey) => {
          const items = byDate[dateKey];
          const d = new Date(dateKey);
          return (
            <section key={dateKey}>
              <div
                className="flex items-baseline gap-3 mb-3 sticky top-0 py-2"
                style={{ background: "var(--bg-screening)" }}
              >
                <p
                  className="display text-base font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {d.toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {items[0].daysUntil === 0
                    ? "today"
                    : `in ${items[0].daysUntil} day${items[0].daysUntil === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((r) => (
                  <Link
                    key={r.id}
                    href={`/film/${r.tmdbId}`}
                    className="rounded-xl overflow-hidden flex"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div
                      className="w-16 aspect-[2/3] shrink-0"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      {r.posterPath && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={tmdbImage(r.posterPath, "w200")}
                          alt={r.title ?? ""}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 p-3 flex flex-col gap-1.5">
                      <p
                        className="text-sm font-semibold leading-tight"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {r.title ?? `tmdb:${r.tmdbId}`}
                      </p>
                      <Pill kind="platform" size="sm" interactive={false}>
                        {r.platform}
                      </Pill>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
