"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

interface DriftData {
  drift: {
    drift_score: number;
    phase_transition: boolean;
    stable: boolean;
    similarity: number;
  };
  adaptations: { adaptation: string; description: string }[];
}

export default function TasteDriftBanner() {
  const { data } = useQuery<DriftData>({
    queryKey: ["taste-drift"],
    queryFn: () => apiFetch("/api/taste/drift"),
    refetchInterval: 5 * 60 * 1000, // check every 5 min
  });

  const showBanner = data?.drift?.phase_transition;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 overflow-hidden rounded-xl border border-accent-green/30 bg-accent-green/10 p-4"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">🔄</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-accent-green/80">
                Your taste is evolving
              </p>
              <p className="text-xs text-accent-green/70 mt-1">
                We&apos;ve noticed your recent picks are different from your usual style.
                Drift score: {Math.round((data?.drift.drift_score ?? 0) * 100)}%
              </p>
              <Link
                href="/onboarding/people"
                className="mt-2 inline-block rounded-lg bg-accent-green px-3 py-1 text-xs font-medium text-bg-primary hover:bg-accent-green/90 transition-colors"
              >
                Update your preferences
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
