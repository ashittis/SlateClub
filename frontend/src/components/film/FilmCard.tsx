"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { tmdbImage } from "../../lib/api";

interface FilmCardProps {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate?: string;
  voteAverage?: number;
  onClick?: (tmdbId: number) => void;
}

export default function FilmCard({
  tmdbId,
  title,
  posterPath,
  releaseDate,
  voteAverage,
  onClick,
}: FilmCardProps) {
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
  const rating = voteAverage != null ? Math.round(voteAverage * 10) / 10 : null;

  return (
    <motion.button
      type="button"
      onClick={() => onClick?.(tmdbId)}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="group relative flex w-full flex-col items-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-green/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary rounded-lg"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-glass-8">
        <Image
          src={tmdbImage(posterPath, "w300")}
          alt={`${title} poster`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
          className="object-cover transition-opacity duration-300 group-hover:opacity-90"
        />

        {/* Rating badge */}
        {rating != null && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-bg-primary/80 px-1.5 py-0.5 text-xs font-semibold text-accent-green backdrop-blur-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
            {rating.toFixed(1)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="mt-2 w-full px-0.5">
        <p className="truncate text-sm font-medium text-text-primary group-hover:text-accent-green/80 transition-colors">
          {title}
        </p>
        {year && (
          <p className="mt-0.5 text-xs text-text-subtle">{year}</p>
        )}
      </div>
    </motion.button>
  );
}
