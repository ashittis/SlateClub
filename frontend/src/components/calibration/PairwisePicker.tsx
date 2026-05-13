"use client";

import { motion } from "framer-motion";
import { tmdbImage } from "../../lib/api";
import type { CalibrationPair } from "../../types/social";

interface Props {
  pair: CalibrationPair;
  onChoice: (choice: "filmA" | "filmB" | "both" | "neither") => void;
}

export default function PairwisePicker({ pair, onChoice }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-center text-lg font-semibold text-text-primary">
        Which feels more like you?
      </h3>

      <div className="flex items-center gap-3">
        {/* Film A */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onChoice("filmA")}
          className="flex-1 overflow-hidden rounded-lg bg-glass-6 transition-colors hover:ring-2 hover:ring-accent-green"
        >
          <div className="aspect-[2/3] w-full">
            <img
              src={tmdbImage(pair.filmA.posterPath, "w300")}
              alt={pair.filmA.title}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-2">
            <p className="truncate text-sm font-medium text-text-primary">{pair.filmA.title}</p>
            {pair.filmA.genres && (
              <p className="truncate text-xs text-text-subtle">
                {(pair.filmA.genres as { name: string }[]).map((g) => g.name).join(", ")}
              </p>
            )}
          </div>
        </motion.button>

        <span className="shrink-0 text-sm font-bold text-text-subtle">vs</span>

        {/* Film B */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onChoice("filmB")}
          className="flex-1 overflow-hidden rounded-lg bg-glass-6 transition-colors hover:ring-2 hover:ring-accent-green"
        >
          <div className="aspect-[2/3] w-full">
            <img
              src={tmdbImage(pair.filmB.posterPath, "w300")}
              alt={pair.filmB.title}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="p-2">
            <p className="truncate text-sm font-medium text-text-primary">{pair.filmB.title}</p>
            {pair.filmB.genres && (
              <p className="truncate text-xs text-text-subtle">
                {(pair.filmB.genres as { name: string }[]).map((g) => g.name).join(", ")}
              </p>
            )}
          </div>
        </motion.button>
      </div>

      <div className="flex justify-center gap-3">
        <button
          onClick={() => onChoice("both")}
          className="rounded-lg border border-glass-6 px-4 py-1.5 text-sm text-glass-40 hover:border-text-subtle"
        >
          Both
        </button>
        <button
          onClick={() => onChoice("neither")}
          className="rounded-lg border border-glass-6 px-4 py-1.5 text-sm text-glass-40 hover:border-text-subtle"
        >
          Neither
        </button>
      </div>
    </div>
  );
}
