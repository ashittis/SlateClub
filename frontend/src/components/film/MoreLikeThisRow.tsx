"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";
import { titleHref } from "@/lib/titleHref";
import FeedRow from "@/components/ui/FeedRow";
import type { SimilarAnswerResponse } from "@/components/discover/SimilarAnswer";

/*
  MoreLikeThisRow — the Film Detail "More like this" discovery rail, fed by
  POST /api/taste-engine/similar (the same taste engine behind the home anchor
  module). Renders as posters with the one-line "why" reason on hover/focus.
  Hidden when the engine returns nothing.
*/

interface Props {
  tmdbId: number;
  mediaType?: string | null;
}

export default function MoreLikeThisRow({ tmdbId, mediaType }: Props) {
  const { data } = useQuery<SimilarAnswerResponse>({
    queryKey: ["more-like-this", tmdbId, mediaType ?? "movie"],
    queryFn: () =>
      apiFetch("/api/taste-engine/similar", {
        method: "POST",
        body: JSON.stringify({
          tmdbId,
          mediaType: mediaType ?? "movie",
          offset: 0,
          languages: [],
        }),
      }),
    staleTime: 5 * 60_000,
  });

  const films = data?.answer ?? [];
  if (films.length === 0) return null;

  return (
    <FeedRow title="More like this">
      {films.map((f) => (
        <motion.div key={f.tmdbId} whileHover={{ scale: 1.03 }} className="shrink-0 w-[140px]">
          <Link href={titleHref(f.tmdbId, mediaType)} className="block">
            <div
              className="relative aspect-[2/3] w-full overflow-hidden rounded-xl"
              style={{ background: "var(--bg-elevated)" }}
            >
              {f.posterPath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={tmdbImage(f.posterPath, "w300")}
                  alt={f.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              {f.matchScore > 0 && (
                <span
                  className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold"
                  style={{ background: "rgba(10,10,11,0.72)", color: "var(--pill-mood)" }}
                >
                  {f.matchScore}%
                </span>
              )}
            </div>
            <p className="mt-2 truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {f.title}
            </p>
            {f.explanation && (
              <p className="line-clamp-2 text-xs" style={{ color: "var(--text-faint)" }}>
                {f.explanation}
              </p>
            )}
          </Link>
        </motion.div>
      ))}
    </FeedRow>
  );
}
