"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { passportApi, passportKeys, type Passport } from "@/lib/api/passport";
import { filmHref } from "@/lib/api/films";
import { formatViewingDate } from "@/lib/api/diary";
import StarRating from "@/components/ratings/StarRating";
import StatGrid from "./StatGrid";
import FollowButton from "@/components/social/FollowButton";

/**
 * The Passport — one component for both "mine" and "theirs".
 *
 * The backend returns an identical shape either way and enforces privacy
 * server-side, so this renders what it's given without branching on ownership
 * except for genuinely owner-only affordances (editing).
 *
 * Laid out like a document rather than a social profile: a header block, a ruled
 * stat table, then the collections. The stats *are* the identity here.
 */
export default function PassportView({ passport }: { passport: Passport }) {
  const { username, stats } = passport;

  const { data: diary } = useQuery({
    queryKey: passportKeys.diary(username),
    queryFn: () => passportApi.diary(username, 12),
  });

  const { data: reviews } = useQuery({
    queryKey: passportKeys.reviews(username),
    queryFn: () => passportApi.reviews(username),
  });

  const location = [passport.city, passport.country].filter(Boolean).join(", ");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-5 lg:px-8">
      {/* Identity block */}
      <header className="flex items-start gap-4">
        <Image
          src={tmdbImage(passport.avatarUrl, "w200")}
          alt={passport.name}
          width={72}
          height={72}
          className="poster h-[72px] w-[72px] shrink-0 rounded-full object-cover"
          unoptimized
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl">
            {passport.name}
          </h1>
          <p className="meta">@{username}</p>
          {passport.bio && <p className="mt-1.5 text-sm">{passport.bio}</p>}
          <p className="meta mt-1">
            {[location, `joined ${formatViewingDate(passport.joinedAt.slice(0, 10))}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {!passport.isOwner && (
          <FollowButton userId={passport.id} username={username} />
        )}
        {passport.isOwner && (
          <span className="flex shrink-0 flex-col gap-1">
            <Link
              href="/passport/share"
              className="meta border px-2.5 py-2 text-center"
              style={{ borderColor: "var(--blood)", color: "var(--blood-ink)" }}
            >
              share
            </Link>
            <Link
              href="/settings"
              className="meta border px-2.5 py-2 text-center"
              style={{ borderColor: "var(--edge)" }}
            >
              edit
            </Link>
          </span>
        )}
      </header>

      <StatGrid stats={stats} />

      <div className="mt-2 flex gap-4">
        <span className="meta">
          <strong style={{ color: "var(--chalk)" }}>{stats.followers}</strong> followers
        </span>
        <span className="meta">
          <strong style={{ color: "var(--chalk)" }}>{stats.following}</strong> following
        </span>
      </div>

      {passport.favouriteFilms.length > 0 && (
        <Section title="Favourite films">
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {passport.favouriteFilms.map((f) => (
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
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {passport.favouritePeople.length > 0 && (
        <Section title="Favourite cast & crew">
          <ul className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {passport.favouritePeople.map((p) => (
              <li key={p.tmdbId} className="w-[68px] shrink-0 text-center">
                <Link href={`/person/${p.tmdbId}`}>
                  <Image
                    src={tmdbImage(p.profilePath, "w200")}
                    alt={p.name}
                    width={68}
                    height={68}
                    className="poster h-[68px] w-[68px] rounded-full object-cover"
                    unoptimized
                  />
                  <span className="mt-1 block truncate text-xs font-medium">{p.name}</span>
                  <span className="meta block truncate">{p.knownFor}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(diary?.length ?? 0) > 0 && (
        <Section title="Recent viewings">
          <ul className="border-t" style={{ borderColor: "var(--edge)" }}>
            {diary!.map((e) => (
              <li
                key={e.entryId}
                className="flex items-center gap-3 border-b py-2"
                style={{ borderColor: "var(--edge)" }}
              >
                <span className="meta w-[88px] shrink-0" style={{ color: "var(--chalk)" }}>
                  {formatViewingDate(e.watchedOn)}
                </span>
                <Link href={filmHref(e)} className="min-w-0 flex-1 truncate text-sm font-medium">
                  {e.title}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  {e.isRewatch && (
                    <span
                      className="meta border px-1.5"
                      style={{ borderColor: "var(--edge)" }}
                    >
                      rewatch
                    </span>
                  )}
                  {e.rating ? <StarRating value={e.rating} readonly size="sm" /> : null}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(reviews?.length ?? 0) > 0 && (
        <Section title="Reviews">
          <ul className="space-y-4">
            {reviews!.slice(0, 5).map((r) => (
              <li key={r.reviewId} className="border-b pb-3" style={{ borderColor: "var(--edge)" }}>
                <Link href={filmHref(r)} className="text-sm font-medium">
                  {r.title}
                  {r.year && <span className="meta ml-1.5">{r.year}</span>}
                </Link>
                {r.spoiler ? (
                  <p className="meta mt-1">review hidden — contains spoilers</p>
                ) : (
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed">{r.body}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {passport.years.length > 0 && (
        <Section title="Wrapped">
          <ul className="flex flex-wrap gap-2">
            {passport.years.map((y) => (
              <li key={y}>
                <Link
                  href={`/passport/wrapped/${y}`}
                  className="flex min-h-[44px] items-center border px-3 text-sm font-medium"
                  style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
                >
                  {y}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {stats.viewings === 0 && (
        <div
          className="mt-6 border border-dashed px-4 py-10 text-center"
          style={{ borderColor: "var(--edge)" }}
        >
          <p className="text-sm font-medium">
            {passport.isOwner ? "Your passport is blank" : "Nothing logged yet"}
          </p>
          <p className="meta mt-1">
            {passport.isOwner
              ? "Log a film and this fills in."
              : "Check back once they've logged something."}
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="section-label">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
