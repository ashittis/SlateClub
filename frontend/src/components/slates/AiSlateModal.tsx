"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Modal from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api";
import type { SlateCard } from "@/types/slates";

/*
  AI Slate (Beta) — single "describe the vibe" input. For now this creates a
  named, empty Slate from the prompt and drops the user on the Slate detail
  page to review/edit. Generation (auto-filling films from the prompt) is a
  follow-up: wire the prompt through POST /api/recommendations/from-anchors
  and add the results to the slate before navigating.
*/

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AiSlateModal({ open, onClose }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [vibe, setVibe] = useState("");

  const create = useMutation({
    mutationFn: () =>
      apiFetch<SlateCard>("/api/slates", {
        method: "POST",
        body: JSON.stringify({
          title: vibe.trim().slice(0, 80),
          description: `AI Slate · ${vibe.trim()}`,
          visibility: "private",
          collaboratorIds: [],
        }),
      }),
    onSuccess: (slate) => {
      qc.invalidateQueries({ queryKey: ["slates"] });
      setVibe("");
      onClose();
      router.push(`/slates/${slate.id}`);
    },
  });

  return (
    <Modal isOpen={open} onClose={onClose} title="AI Slate  ·  Beta">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Describe a mood or vibe and we&apos;ll spin up a Slate you can refine.
        </p>
        <textarea
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Rain-soaked neo-noir with a slow, aching score…"
          className="w-full resize-none rounded-xl p-3 text-sm outline-none"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-primary)",
          }}
        />
        <button
          onClick={() => vibe.trim() && create.mutate()}
          disabled={!vibe.trim() || create.isPending}
          className="w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--cta-gradient)", color: "var(--bg-screening)" }}
        >
          {create.isPending ? "Generating…" : "Generate"}
        </button>
      </div>
    </Modal>
  );
}
