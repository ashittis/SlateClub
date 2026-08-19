"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { discoveryApi, discoveryKeys, type Recommendation } from "@/lib/api/discovery";
import { filmHref } from "@/lib/api/films";

/**
 * "What to watch after this" — the discovery engine's surface.
 *
 * Every recommendation shows *why*: the model's reason when one is available,
 * and otherwise the actual quotes people wrote. Showing the evidence is the
 * point — a recommendation nobody can audit is just an assertion.
 */
export default function SimilarFilms({ tmdbId }: { tmdbId: number }) {
  const [lens, setLens] = useState<"community" | "for_you">("community");

  const { data, isLoading } = useQuery({
    queryKey: discoveryKeys.similar(tmdbId, lens),
    queryFn: () => discoveryApi.similar(tmdbId, lens),
    enabled: Number.isFinite(tmdbId),
  });

  // Nothing collected for this film yet — say so rather than showing a void.
  if (!isLoading && data && !data.warm) {
    return (
      <section className="mt-7">
        <h2 className="section-label">What to watch next</h2>
        <p className="meta mt-2">
          No recommendations collected for this film yet.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between">
        <h2 className="section-label">What to watch next</h2>
        <div className="flex gap-1">
          {(["community", "for_you"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLens(l)}
              className="meta min-h-[32px] border px-2"
              style={{
                borderColor: lens === l ? "var(--chalk)" : "var(--edge)",
                background: lens === l ? "var(--chalk)" : "transparent",
                color: lens === l ? "var(--soot)" : "var(--xerox)",
              }}
            >
              {l === "community" ? "community" : "for you"}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="meta mt-2">Loading…</p>}

      {!isLoading && (data?.results.length ?? 0) > 0 && (
        <ul className="mt-2 border-t" style={{ borderColor: "var(--edge)" }}>
          {data!.results.map((r) => (
            <RecommendationRow key={r.tmdbId} rec={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecommendationRow({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(false);
  const sources = [...new Set(rec.evidence.map((e) => e.sourceName).filter(Boolean))];

  return (
    <li className="border-b py-3" style={{ borderColor: "var(--edge)" }}>
      <div className="flex gap-3">
        <Link href={filmHref(rec)} className="shrink-0">
          <Image
            src={tmdbImage(rec.posterPath, "w200")}
            alt={rec.title}
            width={44}
            height={66}
            className="poster object-cover"
            unoptimized
          />
        </Link>

        <div className="min-w-0 flex-1">
          <Link href={filmHref(rec)} className="text-sm font-medium">
            {rec.title}
            {rec.year && <span className="meta ml-1.5">{rec.year}</span>}
          </Link>

          {/* The model's reason when we have one; the sources' own words when
              we don't. Never a bare assertion. */}
          {rec.reason ? (
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--xerox)" }}>
              {rec.reason}
            </p>
          ) : (
            rec.evidence[0]?.context && (
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--xerox)" }}>
                “{rec.evidence[0].context}”
              </p>
            )
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="meta mt-1.5"
            style={{ color: "var(--blood-ink)" }}
          >
            {rec.evidence.length} mention{rec.evidence.length === 1 ? "" : "s"}
            {sources.length > 0 && ` · ${sources.slice(0, 2).join(", ")}`}
            {open ? " ▴" : " ▾"}
          </button>

          {open && (
            <ul className="mt-2 space-y-1.5 border-l pl-3" style={{ borderColor: "var(--edge)" }}>
              {rec.evidence.map((e, i) => (
                <li key={i}>
                  <p className="text-sm" style={{ color: "var(--xerox)" }}>
                    “{e.context}”
                  </p>
                  <p className="meta">
                    {e.sourceUrl ? (
                      <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="prose-link">
                        {e.sourceName}
                      </a>
                    ) : (
                      e.sourceName
                    )}
                    {e.sentiment && e.sentiment !== "positive" && ` · ${e.sentiment}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
