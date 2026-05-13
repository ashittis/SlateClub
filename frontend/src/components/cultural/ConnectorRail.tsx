"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";

interface ConnectorThread {
  viaPerson: { id: number; name: string; role: string };
  film: {
    tmdbId: number;
    title: string;
    posterPath: string | null;
    releaseDate: string | null;
  };
}

interface Props {
  tmdbId: number;
}

/*
  ConnectorRail — "You loved X. The director also made Y."
  Surfaces the threads the taste graph would otherwise hide.
*/
export default function ConnectorRail({ tmdbId }: Props) {
  const { data, isLoading } = useQuery<{ items: ConnectorThread[] }>({
    queryKey: ["connector", tmdbId],
    queryFn: () => apiFetch(`/api/cultural/connector/${tmdbId}`),
  });

  if (isLoading) return null;
  if (!data || data.items.length === 0) return null;

  return (
    <section
      className="border-t pt-5"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <h3
        className="display text-base font-semibold mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        Threads
      </h3>
      <div className="no-scrollbar -mx-4 px-4 overflow-x-auto pb-2">
        <div className="flex gap-3">
          {data.items.map((t) => (
            <Link
              key={`${t.viaPerson.id}-${t.film.tmdbId}`}
              href={`/film/${t.film.tmdbId}`}
              className="shrink-0 w-[170px] rounded-xl overflow-hidden"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="aspect-[2/3]"
                style={{ background: "var(--bg-elevated)" }}
              >
                {t.film.posterPath && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tmdbImage(t.film.posterPath, "w300")}
                    alt={t.film.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="p-3">
                <p
                  className="text-xs leading-snug"
                  style={{ color: "var(--text-faint)" }}
                >
                  via {t.viaPerson.name}
                  <span style={{ color: "var(--text-muted)" }}>
                    {" "}
                    · {t.viaPerson.role}
                  </span>
                </p>
                <p
                  className="text-sm font-semibold mt-1 truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t.film.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
