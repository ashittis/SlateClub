"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Showtime {
  id: string;
  startsAt: string;
  bookingUrl: string | null;
  theatre: { id: string; name: string; chain: string | null; city: string };
}

interface Props {
  tmdbId: number;
}

/*
  NowShowingSection — theatre listings for this film in the user's
  city. City is currently a manual input until geo lands. The data
  itself is fed by an external partner; the UI is ready for it.
*/
export default function NowShowingSection({ tmdbId }: Props) {
  const [city, setCity] = useState("Mumbai");

  const { data, isLoading } = useQuery<{ items: Showtime[] }>({
    queryKey: ["now-showing", tmdbId, city],
    queryFn: () =>
      apiFetch(
        `/api/now-showing/film/${tmdbId}?city=${encodeURIComponent(city)}`,
      ),
    enabled: !!city,
  });

  if (isLoading) return null;
  if (!data || data.items.length === 0) return null;

  // Group by theatre
  const byTheatre = data.items.reduce<Record<string, Showtime[]>>((acc, s) => {
    (acc[s.theatre.id] ||= []).push(s);
    return acc;
  }, {});

  return (
    <section
      className="border-t pt-5"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3
          className="display text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Now showing
        </h3>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-md px-2.5 py-1 text-xs focus:outline-none"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
      </div>
      <div className="space-y-3">
        {Object.values(byTheatre).map((showtimes) => {
          const t = showtimes[0].theatre;
          return (
            <div
              key={t.id}
              className="rounded-xl p-3"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {t.chain ? `${t.chain} ` : ""}{t.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {showtimes.map((s) => {
                  const time = new Date(s.startsAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <a
                      key={s.id}
                      href={s.bookingUrl ?? "#"}
                      target={s.bookingUrl ? "_blank" : undefined}
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-md text-xs"
                      style={{
                        background: "var(--bg-elevated)",
                        color: "var(--text-primary)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {time}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
