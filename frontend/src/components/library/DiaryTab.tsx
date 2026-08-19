"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { diaryApi, diaryKeys, describeVenue, formatViewingDate } from "@/lib/api/diary";
import { filmHref } from "@/lib/api/films";
import StarRating from "@/components/ratings/StarRating";
import { HeartIcon } from "@/components/log/logIcons";
import EmptyState from "./EmptyState";

/**
 * The diary — every viewing, newest first, grouped by year.
 *
 * A dense dated table rather than a poster wall: this is a record, and the
 * thing you scan for is *when*, not what the poster looks like.
 */
export default function DiaryTab() {
  const { data, isLoading } = useQuery({
    queryKey: diaryKeys.year(),
    queryFn: () => diaryApi.list(),
  });

  if (isLoading) return <p className="meta mt-6">Loading…</p>;
  if (!data?.length) {
    return (
      <EmptyState
        title="Your diary is empty"
        hint="Log a film and it shows up here, with the date you watched it."
      />
    );
  }

  const byYear = new Map<string, typeof data>();
  for (const entry of data) {
    const year = entry.watchedOn.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), entry]);
  }

  return (
    <div className="mt-4">
      {[...byYear.entries()].map(([year, entries]) => (
        <section key={year} className="mb-6">
          <h3 className="section-label">
            {year} · {entries.length} {entries.length === 1 ? "viewing" : "viewings"}
          </h3>
          <ul className="mt-2 border-t-2" style={{ borderColor: "var(--edge)" }}>
            {entries.map((e) => (
              <li key={e.entryId} className="border-b-2" style={{ borderColor: "var(--edge)" }}>
                <div className="flex items-start gap-3 py-2.5">
                  <Link href={filmHref(e)} className="shrink-0">
                    <Image
                      src={tmdbImage(e.posterPath, "w200")}
                      alt=""
                      width={36}
                      height={54}
                      className="poster object-cover"
                      unoptimized
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={filmHref(e)} className="block">
                      <span className="text-sm font-medium leading-tight">{e.title}</span>
                      {e.year && <span className="meta ml-1.5">{e.year}</span>}
                    </Link>
                    <p className="meta mt-0.5">
                      {formatViewingDate(e.watchedOn)} · {describeVenue(e)}
                    </p>
                    {e.tags.length > 0 && (
                      <p className="meta mt-0.5">
                        {e.tags.map((t) => `#${t}`).join("  ")}
                      </p>
                    )}
                    {e.review &&
                      (e.review.spoiler ? (
                        <p className="meta mt-1">review hidden — contains spoilers</p>
                      ) : (
                        <p
                          className="mt-1 line-clamp-2 text-sm"
                          style={{ color: "var(--xerox)" }}
                        >
                          {e.review.body}
                        </p>
                      ))}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="flex items-center gap-1.5">
                      {e.rating ? <StarRating value={e.rating} readonly size="sm" /> : null}
                      {e.liked && (
                        <span role="img" aria-label="Liked" style={{ color: "var(--chalk)" }}>
                          <HeartIcon filled className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </span>
                    <span className="flex gap-1">
                      {e.isRewatch && <Tag>rewatch</Tag>}
                      {e.visibility === "private" && <Tag>private</Tag>}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="meta border px-1.5"
      style={{ borderColor: "var(--edge)", color: "var(--xerox)" }}
    >
      {children}
    </span>
  );
}
