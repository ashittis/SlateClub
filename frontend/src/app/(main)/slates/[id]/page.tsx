"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import SlateFilmRow from "@/components/slates/SlateFilmRow";
import SlateRoom from "@/components/slates/SlateRoom";
import type { SlateDetail } from "@/types/slates";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SlateDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [roomOpen, setRoomOpen] = useState(false);

  const { data, isLoading } = useQuery<SlateDetail>({
    queryKey: ["slate", id],
    queryFn: () => apiFetch(`/api/slates/${id}`),
  });

  const saveMut = useMutation({
    mutationFn: (saved: boolean) =>
      apiFetch(`/api/slates/${id}/save`, {
        method: saved ? "DELETE" : "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["slate", id] }),
  });

  const removeFilmMut = useMutation({
    mutationFn: (tmdbId: number) =>
      apiFetch(`/api/slates/${id}/films/${tmdbId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["slate", id] }),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-24">
        <div
          className="h-8 w-48 rounded mb-3 animate-pulse"
          style={{ background: "var(--bg-card)" }}
        />
        <div
          className="h-32 rounded-2xl animate-pulse"
          style={{ background: "var(--bg-card)" }}
        />
      </div>
    );
  }

  const isCreator = user?.id === data.creator?.id;

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 pb-24">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
        <div>
          <div className="mb-6">
            <h1
              className="display text-3xl lg:text-4xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {data.title}
            </h1>
            {data.description && (
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {data.description}
              </p>
            )}
            <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
              {data.creator?.name ?? "—"} · {data.filmCount} film
              {data.filmCount === 1 ? "" : "s"}
              {data.saveCount > 0 ? ` · ♡ ${data.saveCount}` : ""}
            </p>

            <div className="mt-4 flex gap-2 flex-wrap">
              {!isCreator && user && (
                <button
                  onClick={() => saveMut.mutate(data.savedByMe)}
                  className="px-4 py-2 rounded-full text-xs font-semibold"
                  style={{
                    background: data.savedByMe
                      ? "var(--bg-elevated)"
                      : "var(--cta-primary)",
                    color: data.savedByMe
                      ? "var(--text-primary)"
                      : "var(--bg-screening)",
                    border: data.savedByMe
                      ? "1px solid rgba(255,255,255,0.06)"
                      : "none",
                  }}
                >
                  {data.savedByMe ? "✓ Saved" : "Save Slate"}
                </button>
              )}
              <button
                onClick={() => setRoomOpen((v) => !v)}
                className="px-4 py-2 rounded-full text-xs font-semibold lg:hidden"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {roomOpen ? "Hide Slate Room" : "Discuss this Slate"}
              </button>
              <button
                onClick={() => navigator.share?.({ url: window.location.href })}
                className="px-4 py-2 rounded-full text-xs font-semibold"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                Share
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {data.films.length === 0 ? (
              <p
                className="text-sm rounded-xl p-6 text-center"
                style={{
                  color: "var(--text-faint)",
                  background: "var(--bg-card)",
                  border: "1px dashed rgba(255,255,255,0.06)",
                }}
              >
                No films yet.
              </p>
            ) : (
              data.films.map((f) => (
                <SlateFilmRow
                  key={f.tmdbId}
                  film={f}
                  onRemove={
                    isCreator
                      ? () => removeFilmMut.mutate(f.tmdbId)
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </div>

        {/* Desktop Slate Room — side-by-side per vision. */}
        <aside className="hidden lg:block">
          <SlateRoom slateId={id} />
        </aside>
      </div>

      {/* Mobile Slate Room — bottom sheet. */}
      <AnimatePresence>
        {roomOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRoomOpen(false)}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: "rgba(0,0,0,0.55)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="fixed inset-x-0 bottom-0 z-50 lg:hidden h-[80vh]"
            >
              <SlateRoom slateId={id} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
