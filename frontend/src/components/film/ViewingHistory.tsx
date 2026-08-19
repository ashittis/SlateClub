"use client";

import { useQuery } from "@tanstack/react-query";
import { filmKeys, filmsApi } from "@/lib/api/films";
import { formatViewingDate } from "@/lib/api/diary";
import StarRating from "@/components/ratings/StarRating";
import { HeartIcon } from "@/components/log/logIcons";

/**
 * Your own history with this film — every logged viewing, newest first.
 *
 * This is where rewatch becomes visible rather than merely stored. The spec's
 * example is exactly this table:
 *
 *     2026   ★★★★★   Rewatch
 *     2024   ★★★★★
 *
 * Rendered as a real table because that is what it is: dense, dated, scannable.
 */
export default function ViewingHistory({ tmdbId }: { tmdbId: number }) {
  const { data } = useQuery({
    queryKey: filmKeys.viewings(tmdbId),
    queryFn: () => filmsApi.viewings(tmdbId),
    enabled: Number.isFinite(tmdbId),
  });

  const viewings = data?.viewings ?? [];
  if (viewings.length === 0) return null;

  return (
    <section className="mt-7">
      <h2 className="section-label">
        Your history · {viewings.length} {viewings.length === 1 ? "viewing" : "viewings"}
      </h2>

      <ul className="mt-2 border-t" style={{ borderColor: "var(--edge)" }}>
        {viewings.map((v) => (
          <li
            key={v.id}
            className="border-b py-2.5"
            style={{ borderColor: "var(--edge)" }}
          >
            <div className="flex items-center gap-3">
              <span className="meta w-[92px] shrink-0" style={{ color: "var(--chalk)" }}>
                {formatViewingDate(v.watchedOn)}
              </span>

              <span className="flex shrink-0 items-center gap-1.5">
                {v.rating ? (
                  <StarRating value={v.rating} readonly size="sm" />
                ) : (
                  <span className="meta">no rating</span>
                )}
                {v.liked && (
                  <span role="img" aria-label="Liked" style={{ color: "var(--chalk)" }}>
                    <HeartIcon filled className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>

              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {v.isRewatch && <Tag>rewatch</Tag>}
                {v.watchType === "theatre" && <Tag>theatre</Tag>}
                {v.visibility === "private" && <Tag>private</Tag>}
              </span>
            </div>

            {v.tags.length > 0 && (
              <p className="meta mt-1.5 pl-[104px]">
                {v.tags.map((t) => `#${t}`).join("  ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="meta border px-1.5 py-0.5"
      style={{ borderColor: "var(--edge)", color: "var(--xerox)" }}
    >
      {children}
    </span>
  );
}
