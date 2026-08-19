"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { wrappedApi, wrappedKeys } from "@/lib/api/wrapped";
import { filmHref } from "@/lib/api/films";
import { formatViewingDate } from "@/lib/api/diary";
import ShareCard from "@/components/passport/ShareCard";

/**
 * Wrapped — the year, at length.
 *
 * Scrolls rather than tapping through: SlateClub's story format made the
 * numbers hard to compare and impossible to go back to. A year in film is
 * something you read, and a page can be screenshotted in pieces.
 */
export default function WrappedPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: raw } = use(params);
  const year = Number.parseInt(raw, 10);

  const { data, isLoading } = useQuery({
    queryKey: wrappedKeys.year(year),
    queryFn: () => wrappedApi.year(year),
    enabled: Number.isFinite(year),
  });

  if (isLoading) return <p className="meta px-4 py-16">Loading…</p>;
  if (!data) return <p className="meta px-4 py-16">Nothing to show.</p>;

  if (data.viewings === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{year}</h1>
        <p className="meta mt-2">You didn&apos;t log anything in {year}.</p>
        <Link
          href="/search"
          className="mt-5 inline-flex min-h-[44px] items-center border px-4 text-sm font-semibold"
          style={{
            borderColor: "var(--blood)",
            background: "var(--blood)",
            color: "var(--chalk)",
          }}
        >
          Log a film
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-5 lg:px-8">
      <header>
        <p className="section-label">Wrapped</p>
        <h1 className="text-4xl font-bold tracking-tight">{year}</h1>
        <p className="meta mt-1">
          {data.films} films · {data.viewings} viewings · {data.hours} hours
        </p>
      </header>

      {data.firstFilm && data.lastFilm && (
        <section className="mt-7">
          <h2 className="section-label">How it started, how it ended</h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[
              { label: "First", film: data.firstFilm },
              { label: "Last", film: data.lastFilm },
            ].map(({ label, film }) => (
              <Link
                key={label}
                href={filmHref(film)}
                className="flex gap-2.5 border p-2"
                style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
              >
                <Image
                  src={tmdbImage(film.posterPath, "w200")}
                  alt=""
                  width={40}
                  height={60}
                  className="poster shrink-0 object-cover"
                  unoptimized
                />
                <span className="min-w-0">
                  <span className="section-label block">{label}</span>
                  <span className="block truncate text-sm font-medium">{film.title}</span>
                  <span className="meta block">{formatViewingDate(film.watchedOn)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(data.topRated?.length ?? 0) > 0 && (
        <section className="mt-7">
          <h2 className="section-label">Your highest rated</h2>
          <ul className="mt-2 grid grid-cols-5 gap-2">
            {data.topRated!.map((f) => (
              <li key={f.tmdbId}>
                <Link href={filmHref(f)}>
                  <Image
                    src={tmdbImage(f.posterPath, "w200")}
                    alt={f.title}
                    width={100}
                    height={150}
                    className="poster w-full object-cover"
                    unoptimized
                  />
                  <span className="meta mt-1 block">{f.rating}★</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-7">
        <h2 className="section-label">Card</h2>
        <div className="mt-2">
          <ShareCard data={data} />
        </div>
        <p className="meta mt-2">
          Screenshot to share, or pick another period on the{" "}
          <Link href="/passport/share" className="prose-link">share page</Link>.
        </p>
      </section>
    </div>
  );
}
