"use client";

import Image from "next/image";
import { tmdbImage } from "@/lib/api/client";
import type { ShareCard as ShareCardData } from "@/lib/api/wrapped";

/**
 * A shareable card — a month or a year of someone's cinema life.
 *
 * Fixed aspect and self-contained so it screenshots cleanly, which is how these
 * actually get shared. Built like a printed ticket stub: ruled figures, heavy
 * type, one accent. Nothing here depends on hover or interaction.
 *
 * `films` and `viewings` both appear. They diverge on every rewatch, and a card
 * showing only one would misrepresent the period.
 */
export default function ShareCard({ data }: { data: ShareCardData }) {
  const stats: { label: string; value: string | number }[] = [
    { label: "Films", value: data.films },
    { label: "Viewings", value: data.viewings },
    { label: "In theatres", value: data.theatreVisits ?? 0 },
    { label: "Rewatches", value: data.rewatches ?? 0 },
    { label: "Hours", value: data.hours ?? 0 },
    { label: "Avg rating", value: data.averageRating ?? "—" },
  ];

  return (
    <article
      className="mx-auto w-full max-w-md border p-5"
      style={{
        background: "var(--soot)",
        borderColor: "var(--edge-hot)",
        borderWidth: 2,
      }}
    >
      <header
        className="flex items-baseline justify-between border-b pb-2"
        style={{ borderColor: "var(--edge)" }}
      >
        <span className="section-label">KASET · {data.label ?? data.year}</span>
        <span className="meta">@{data.user.username}</span>
      </header>

      {data.viewings === 0 ? (
        <p className="py-10 text-center text-sm" style={{ color: "var(--xerox)" }}>
          Nothing logged in {data.label ?? data.year}.
        </p>
      ) : (
        <>
          <dl
            className="mt-4 grid grid-cols-3 border-l border-t"
            style={{ borderColor: "var(--edge)" }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="border-b border-r px-2 py-2.5"
                style={{ borderColor: "var(--edge)" }}
              >
                <dd className="text-xl font-bold leading-none tabular-nums">{s.value}</dd>
                <dt className="section-label mt-1 block">{s.label}</dt>
              </div>
            ))}
          </dl>

          {data.favouriteFilm && (
            <section className="mt-4 flex items-center gap-3">
              <Image
                src={tmdbImage(data.favouriteFilm.posterPath, "w200")}
                alt=""
                width={44}
                height={66}
                className="poster shrink-0 object-cover"
                unoptimized
              />
              <div className="min-w-0">
                <p className="section-label">Favourite</p>
                <p className="truncate text-sm font-bold">{data.favouriteFilm.title}</p>
                <p className="meta">
                  {data.favouriteFilm.year} · {data.favouriteFilm.rating}★
                </p>
              </div>
            </section>
          )}

          <dl className="mt-4 space-y-1.5">
            {data.topDirector && (
              <Row label="Most watched director" value={`${data.topDirector.name} · ${data.topDirector.count}`} />
            )}
            {data.topActor && (
              <Row label="Most watched actor" value={`${data.topActor.name} · ${data.topActor.count}`} />
            )}
            {data.mostRewatched && (
              <Row label="Most rewatched" value={`${data.mostRewatched.title} · ${data.mostRewatched.views}×`} />
            )}
            {(data.streak ?? 0) > 1 && (
              <Row label="Longest streak" value={`${data.streak} days`} />
            )}
            {(data.topGenres?.length ?? 0) > 0 && (
              <Row label="Genres" value={data.topGenres!.slice(0, 3).map((g) => g.name).join(", ")} />
            )}
          </dl>

          {(data.topRated?.length ?? 0) > 0 && (
            <section className="mt-4">
              <p className="section-label">Top rated</p>
              <ul className="mt-1.5 flex gap-1.5">
                {data.topRated!.slice(0, 5).map((f) => (
                  <li key={f.tmdbId} className="flex-1">
                    <Image
                      src={tmdbImage(f.posterPath, "w200")}
                      alt={f.title}
                      width={70}
                      height={105}
                      className="poster w-full object-cover"
                      unoptimized
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* An honest footnote — a low `hours` should read as thin data, not
              a thin year. */}
          {(data.filmsMissingRuntime ?? 0) > 0 && (
            <p className="meta mt-3">
              {data.filmsMissingRuntime} film(s) had no runtime on record
            </p>
          )}
        </>
      )}
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 border-b pb-1"
      style={{ borderColor: "var(--edge)" }}
    >
      <dt className="section-label shrink-0">{label}</dt>
      <dd className="meta truncate text-right" style={{ color: "var(--chalk)" }}>
        {value}
      </dd>
    </div>
  );
}
