"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { filmKeys, filmsApi } from "@/lib/api/films";
import Avatar from "@/components/ui/Avatar";

/**
 * "Your friends — 6 watched".
 *
 * The strongest signal a film page can carry. An aggregate score tells you what
 * strangers thought; this tells you that three people whose taste you chose to
 * follow have already seen it, and what they made of it.
 *
 * Renders nothing at all when no one you follow has logged the film. An empty
 * "nobody yet" panel is worse than silence — it makes a quiet network feel like
 * a broken feature.
 */
export default function FriendsWatched({ tmdbId }: { tmdbId: number }) {
  const { data } = useQuery({
    queryKey: filmKeys.friends(tmdbId),
    queryFn: () => filmsApi.friends(tmdbId),
    enabled: Number.isFinite(tmdbId),
  });

  const friends = data?.friends ?? [];
  if (friends.length === 0) return null;

  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="section-label">Your friends</h2>
        <span className="section-label">{data!.total} watched</span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-3">
        {friends.map((f) => (
          <li key={f.id}>
            <Link
              href={`/passport/${f.username}`}
              className="flex w-11 flex-col items-center gap-1"
              title={
                f.rating
                  ? `${f.name} rated this ${f.rating}`
                  : `${f.name} logged this`
              }
            >
              <Avatar avatarUrl={f.avatar_url} name={f.name} size="md" />
              {f.rating ? (
                <span className="meta flex items-center gap-0.5 leading-none">
                  {/*
                    Drawn, not typed. `★` (U+2605) is absent from JetBrains
                    Mono, so the `.meta` class rendered it through a fallback
                    face — it came out as a lopsided asterisk next to the number.
                  */}
                  <StarGlyph />
                  {f.rating}
                </span>
              ) : (
                <span className="meta leading-none">seen</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Same geometry as the rating stars, at caption size. */
function StarGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 22 22" aria-hidden style={{ color: "var(--acid)" }}>
      <path
        d="M11 1.6l2.9 6 6.6.9-4.8 4.6 1.2 6.6L11 16.6 5.1 19.7l1.2-6.6L1.5 8.5l6.6-.9z"
        fill="currentColor"
      />
    </svg>
  );
}
