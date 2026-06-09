"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";
import type { SlateCard } from "@/types/slates";
import CreateSlateModal from "./CreateSlateModal";

interface Props {
  open: boolean;
  onClose: () => void;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
}

/* Add a film/series to one of the user's slates, or spin up a new one. */
export default function AddToSlateSheet({ open, onClose, tmdbId, mediaType, title }: Props) {
  const qc = useQueryClient();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const mine = useQuery<{ items: SlateCard[] }>({
    queryKey: ["slates", "mine"],
    queryFn: () => apiFetch("/api/slates/mine"),
    enabled: open,
  });

  const add = useMutation({
    mutationFn: (slateId: string) =>
      apiFetch(`/api/slates/${slateId}/films`, {
        method: "POST",
        body: JSON.stringify({ tmdbId, mediaType }),
      }),
    onSuccess: (_data, slateId) => {
      setAdded((s) => new Set(s).add(slateId));
      qc.invalidateQueries({ queryKey: ["slate", slateId] });
    },
  });

  if (!open) return null;
  const items = mine.data?.items ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
        style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="display text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Add to Slate
        </h3>
        <p className="mb-3 mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>
          {title}
        </p>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left cursor-pointer"
          style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,138,0,0.35)" }}
        >
          <span className="grid h-10 w-10 place-items-center rounded-lg text-xl" style={{ background: "rgba(255,138,0,0.15)", color: "var(--cta-primary)" }}>
            +
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Create New Slate
          </span>
        </button>

        {mine.isLoading ? (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: "var(--text-faint)" }}>
            No slates yet — create one above.
          </p>
        ) : (
          <div className="space-y-1">
            {items.map((s) => {
              const on = added.has(s.id);
              const cover = s.coverPosters?.[0];
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={on || add.isPending}
                  onClick={() => add.mutate(s.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                    {cover && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={tmdbImage(cover, "w200")} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.title}</p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>{s.filmCount} titles</p>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: on ? "var(--accent-green, #4ade80)" : "var(--cta-primary)" }}>
                    {on ? "Added ✓" : "Add"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CreateSlateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(slate) => {
          // Immediately drop the current title into the new slate.
          add.mutate(slate.id);
          qc.invalidateQueries({ queryKey: ["slates", "mine"] });
        }}
      />
    </div>
  );
}
