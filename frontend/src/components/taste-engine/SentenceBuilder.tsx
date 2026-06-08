"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import Pill from "@/components/ui/Pill";
import SwapSheet from "./SwapSheet";
import type { PillKind } from "@/lib/design-tokens";

export interface Sentence {
  mood: string | null;
  genre: string | null;
  language: string | null;
  platform: string | null;
  era: string | null;
}

interface OptionsResponse {
  mood: { key: string; label: string }[];
  genre: { key: string; label: string }[];
  language: { key: string; label: string }[];
  platform: { key: string; label: string }[];
  era: { key: string; label: string }[];
}

interface SentenceBuilderProps {
  value: Sentence;
  onChange: (next: Sentence) => void;
  onSubmit: () => void;
  matchCount: number | null;
  loadingCount: boolean;
}

type Slot = keyof Sentence;

const SLOT_KIND: Record<Slot, PillKind> = {
  mood: "mood",
  genre: "genre",
  language: "language",
  platform: "platform",
  era: "era",
};

const SLOT_PLACEHOLDER: Record<Slot, string> = {
  mood: "any mood",
  genre: "any genre",
  language: "any language",
  platform: "any platform",
  era: "any era",
};

export default function SentenceBuilder({
  value,
  onChange,
  onSubmit,
  matchCount,
  loadingCount,
}: SentenceBuilderProps) {
  const { data: options } = useQuery<OptionsResponse>({
    queryKey: ["taste-engine-options"],
    queryFn: () => apiFetch("/api/taste-engine/options"),
    staleTime: 1000 * 60 * 60,
  });

  const [openSlot, setOpenSlot] = useState<Slot | null>(null);

  const labelFor = (slot: Slot): string => {
    if (!options) return SLOT_PLACEHOLDER[slot];
    const v = value[slot];
    if (!v) return SLOT_PLACEHOLDER[slot];
    return options[slot].find((o) => o.key === v)?.label ?? v;
  };

  return (
    <div
      className="rounded-2xl p-5 lg:p-6"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 24px 60px -28px rgba(0,0,0,0.55)",
      }}
    >
      <p
        className="text-xs uppercase tracking-[0.25em] mb-3"
        style={{ color: "var(--text-faint)" }}
      >
        Taste Engine
      </p>

      <div
        className="text-xl lg:text-2xl leading-relaxed flex flex-wrap gap-x-2 gap-y-3 items-center display"
        style={{ color: "var(--text-primary)" }}
      >
        <span>Show me</span>
        {(["mood", "genre"] as Slot[]).map((slot) => (
          <Pill
            key={slot}
            kind={SLOT_KIND[slot]}
            active={!!value[slot]}
            onClick={() => setOpenSlot(slot)}
          >
            {labelFor(slot)}
          </Pill>
        ))}
        <span>films in</span>
        <Pill
          kind="language"
          active={!!value.language}
          onClick={() => setOpenSlot("language")}
        >
          {labelFor("language")}
        </Pill>
        <span>on</span>
        <Pill
          kind="platform"
          active={!!value.platform}
          onClick={() => setOpenSlot("platform")}
        >
          {labelFor("platform")}
        </Pill>
        <span>from the</span>
        <Pill
          kind="era"
          active={!!value.era}
          onClick={() => setOpenSlot("era")}
        >
          {labelFor("era")}
        </Pill>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <motion.span
          key={matchCount ?? "loading"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {loadingCount
            ? "Counting…"
            : matchCount === null
              ? "—"
              : `${matchCount} ${matchCount === 1 ? "film" : "films"} match`}
        </motion.span>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!matchCount}
          className="px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
          style={{
            background: "var(--cta-gradient)",
            color: "var(--bg-screening)",
            cursor: matchCount ? "pointer" : "not-allowed",
            boxShadow: matchCount
              ? "0 12px 28px -10px rgba(255, 138, 0, 0.55)"
              : "none",
          }}
        >
          Show me →
        </button>
      </div>

      {options && openSlot && (
        <SwapSheet
          open
          title={`Choose ${openSlot}`}
          kind={SLOT_KIND[openSlot]}
          options={options[openSlot]}
          selected={value[openSlot]}
          onPick={(key) => onChange({ ...value, [openSlot]: key })}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
}
