"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { SHELF_REASONS } from "@/lib/shelfReasons";

export interface ShelfNotePayload {
  reasonType: string | null;
  reasonReference: string | null;
  note: string | null;
}

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Called with the captured note/reason on Save, or nulls on Skip. */
  onSubmit: (payload: ShelfNotePayload) => void;
  pending?: boolean;
}

interface TmdbMovie {
  id: number;
  title: string;
  release_date: string | null;
}

/*
  Shelf note — note-first and calm (Apple Notes / Notion feel). The free-text
  thought is the primary interaction; quick-tags and "Reminds you of…" are
  small, optional, and muted. No saturated pills, no orange glow.
*/
export default function ShelfNoteSheet({
  open,
  title,
  onClose,
  onSubmit,
  pending,
}: Props) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<string | null>(null);
  const [remindsOf, setRemindsOf] = useState<{ title: string } | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const search = useQuery<{ results: TmdbMovie[] }>({
    queryKey: ["shelf-reminds-search", debounced],
    queryFn: () =>
      apiFetch(`/api/movies/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length >= 2 && !remindsOf,
    staleTime: 60_000,
  });

  if (!open) return null;

  const reset = () => {
    setNote("");
    setReason(null);
    setRemindsOf(null);
    setQuery("");
  };

  const save = () => {
    onSubmit({
      reasonType: remindsOf ? "similar_movie" : reason,
      reasonReference: remindsOf?.title ?? null,
      note: note.trim() || null,
    });
    reset();
  };

  const skip = () => {
    onSubmit({ reasonType: null, reasonReference: null, note: null });
    reset();
  };

  const hits = (search.data?.results ?? []).slice(0, 5);
  const showHits = !remindsOf && debounced.length >= 2 && hits.length > 0;

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
          Add to Shelf
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>
          {title}
        </p>

        {/* Note — the primary interaction. */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's pulling you toward this film?"
          rows={3}
          autoFocus
          className="mt-4 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        <div
          className="h-px w-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        {/* Reminds you of… (optional, sets similar_movie + reference). */}
        <div className="mt-4">
          {remindsOf ? (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                Reminds you of
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {remindsOf.title}
                <button
                  type="button"
                  onClick={() => setRemindsOf(null)}
                  aria-label="Clear"
                  className="cursor-pointer opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            </div>
          ) : (
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Reminds you of another film?"
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              {showHits && (
                <div
                  className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-xl p-1"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {hits.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setRemindsOf({ title: m.title });
                        setQuery("");
                      }}
                      className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:opacity-90 cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {m.title}
                      {m.release_date ? (
                        <span style={{ color: "var(--text-faint)" }}>
                          {" "}
                          · {m.release_date.slice(0, 4)}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tiny muted quick-tags. */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {SHELF_REASONS.map((r) => {
            const on = reason === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setReason(on ? null : r.key)}
                className="rounded-full px-2.5 py-1 text-xs transition-colors cursor-pointer"
                style={{
                  background: on ? "rgba(255,255,255,0.10)" : "transparent",
                  color: on ? "var(--text-primary)" : "var(--text-faint)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-end gap-4">
          <button
            onClick={skip}
            disabled={pending}
            className="text-sm transition-opacity hover:opacity-80 disabled:opacity-50 cursor-pointer"
            style={{ color: "var(--text-faint)" }}
          >
            Skip
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="rounded-full px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {pending ? "Saving…" : "Save to Shelf"}
          </button>
        </div>
      </div>
    </div>
  );
}
