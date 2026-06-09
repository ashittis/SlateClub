"use client";

import { useState } from "react";
import Pill from "@/components/ui/Pill";
import { DNF_REASONS, DNF_STOPPED_AT } from "@/lib/shelfReasons";

export interface DnfPayload {
  stoppedAt: string | null;
  reason: string | null;
}

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (payload: DnfPayload) => void;
  pending?: boolean;
}

/*
  DNF sheet — "where did you stop, and why?". Both fields optional so a user
  can abandon a film with one tap, but the reason feeds the taste engine.
*/
export default function DNFSheet({
  open,
  title,
  onClose,
  onSubmit,
  pending,
}: Props) {
  const [stoppedAt, setStoppedAt] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  if (!open) return null;

  const confirm = () => {
    onSubmit({ stoppedAt, reason });
    setStoppedAt(null);
    setReason(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="display text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Didn&apos;t finish “{title}”
        </h3>

        <p className="mb-2 mt-4 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Stopped watching at
        </p>
        <div className="flex flex-wrap gap-2">
          {DNF_STOPPED_AT.map((s) => (
            <Pill
              key={s.key}
              kind="era"
              size="sm"
              active={stoppedAt === s.key}
              onClick={() => setStoppedAt(stoppedAt === s.key ? null : s.key)}
            >
              {s.label}
            </Pill>
          ))}
        </div>

        <p className="mb-2 mt-4 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Reason?
        </p>
        <div className="flex flex-wrap gap-2">
          {DNF_REASONS.map((r) => (
            <Pill
              key={r.key}
              kind="neutral"
              size="sm"
              active={reason === r.key}
              onClick={() => setReason(reason === r.key ? null : r.key)}
            >
              {r.label}
            </Pill>
          ))}
        </div>

        <button
          onClick={confirm}
          disabled={pending}
          className="mt-5 w-full rounded-full py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          style={{ background: "var(--cta-gradient)", boxShadow: "var(--cta-glow)" }}
        >
          {pending ? "Saving…" : "Mark as DNF"}
        </button>
      </div>
    </div>
  );
}
