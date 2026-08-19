"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { filmHref, filmKeys, filmsApi } from "@/lib/api/films";
import Page from "@/components/layout/Page";

/**
 * A director or actor, and their films.
 *
 * Reached from a name on a film page or from Search. Deliberately thin: Kaset
 * has no artist profiles, posts or AMAs — a person is a route *into* films,
 * not a social surface (KASET.md §2).
 */
export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const personId = Number.parseInt(id, 10);

  const { data: person, isLoading } = useQuery({
    queryKey: filmKeys.person(personId),
    queryFn: () => filmsApi.person(personId),
    enabled: Number.isFinite(personId),
  });

  if (isLoading) {
    return (
      <Page>
        <p className="meta">Loading…</p>
      </Page>
    );
  }
  if (!person) {
    return (
      <Page>
        <p className="text-sm" style={{ color: "var(--xerox)" }}>
          We couldn&apos;t find that person.
        </p>
      </Page>
    );
  }

  return (
    <Page>
      <header className="flex gap-4">
        <Image
          src={tmdbImage(person.profilePath, "w200")}
          alt={person.name}
          width={96}
          height={96}
          className="poster h-24 w-24 shrink-0 rounded-full object-cover"
          unoptimized
        />
        <div className="min-w-0">
          <h1 className="text-2xl">{person.name}</h1>
          {person.knownFor && <p className="meta mt-1">{person.knownFor}</p>}
          <p className="meta mt-0.5">{person.films.length} films</p>
        </div>
      </header>

      {person.biography && (
        <section className="mt-5">
          <h2 className="section-label">Biography</h2>
          <p className="mt-1.5 line-clamp-6 text-sm leading-relaxed">{person.biography}</p>
        </section>
      )}

      <section className="mt-7">
        <h2 className="section-label">Filmography</h2>
        <ul className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {person.films.map((f) => (
            <li key={f.tmdbId}>
              <Link href={filmHref(f)} className="block">
                <Image
                  src={tmdbImage(f.posterPath, "w200")}
                  alt={f.title}
                  width={120}
                  height={180}
                  className="poster w-full object-cover"
                  unoptimized
                />
                <span className="mt-1 block text-xs font-medium leading-tight">{f.title}</span>
                <span className="meta block">{f.year ?? "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Page>
  );
}
