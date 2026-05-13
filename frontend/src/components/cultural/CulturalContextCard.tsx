"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";

interface Props {
  tmdbId: number;
}

interface ContextResp {
  context: { headline: string; body: string; source: string | null } | null;
}

export default function CulturalContextCard({ tmdbId }: Props) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery<ContextResp>({
    queryKey: ["cultural-context", tmdbId],
    queryFn: () => apiFetch(`/api/cultural/context/${tmdbId}`),
  });

  if (!data?.context) return null;

  return (
    <div
      className="rounded-xl p-4 my-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(184,149,106,0.25)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center justify-between"
      >
        <span
          className="text-xs uppercase tracking-wider"
          style={{ color: "var(--pill-language)" }}
        >
          Cultural context
        </span>
        <span
          className="text-xs"
          style={{ color: "var(--text-faint)" }}
        >
          {open ? "Hide" : "Read first"}
        </span>
      </button>
      <p
        className="display text-sm font-semibold mt-1"
        style={{ color: "var(--text-primary)" }}
      >
        {data.context.headline}
      </p>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {data.context.body}
            </p>
            {data.context.source && (
              <p
                className="mt-2 text-xs"
                style={{ color: "var(--text-faint)" }}
              >
                — {data.context.source}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
