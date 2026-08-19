"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { tmdbImage } from "@/lib/api/client";
import { messagesApi } from "@/lib/api/messages";
import { searchApi } from "@/lib/api/search";
import type { FilmDetail } from "@/lib/api/films";

/**
 * Share a film with someone.
 *
 * Sends into the normal conversation model, so the film lands in the thread and
 * the recipient can reply. SlateClub's equivalent dropped it into a separate
 * one-shot inbox where the only possible response was a canned reaction.
 *
 * The recipient picker searches people rather than listing "friends" — Kaset's
 * follow graph is one-directional, so there is no mutual-friends set to show.
 */
export default function ShareFilmSheet({
  film,
  onClose,
}: {
  film: FilmDetail;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<
    { id: string; name: string; username: string; avatarUrl: string | null }[]
  >([]);
  const [note, setNote] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setPeople([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { items } = await searchApi.users(term);
        if (!cancelled) setPeople(items);
      } catch {
        if (!cancelled) setPeople([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const send = async (userId: string, name: string) => {
    setPending(userId);
    try {
      await messagesApi.sendTo(userId, note.trim() || undefined, film.tmdbId);
      setSentTo(name);
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(20,18,14,0.45)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${film.title}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full overflow-y-auto border sm:max-w-md"
        style={{ background: "var(--soot)", borderColor: "var(--edge-hot)" }}
      >
        <header
          className="flex items-start gap-3 border-b-2 p-4"
          style={{ borderColor: "var(--edge)" }}
        >
          <Image
            src={tmdbImage(film.posterPath, "w200")}
            alt=""
            width={40}
            height={60}
            className="poster shrink-0 object-cover"
            unoptimized
          />
          <div className="min-w-0 flex-1">
            <p className="section-label">Share</p>
            <h2 className="truncate text-base font-bold leading-tight">{film.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-11 w-11 items-center justify-center text-lg"
            style={{ color: "var(--xerox)" }}
          >
            ×
          </button>
        </header>

        {sentTo ? (
          <div className="p-6 text-center">
            <p className="text-sm font-medium" style={{ color: "var(--acid)" }}>
              Sent to {sentTo}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 min-h-[44px] border px-4 text-sm"
              style={{ borderColor: "var(--edge)" }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Say something (optional)"
              className="min-h-[44px] w-full border px-3 text-sm"
              style={{ borderColor: "var(--edge)", background: "var(--void)" }}
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people"
              autoComplete="off"
              className="min-h-[48px] w-full border px-3 text-base"
              style={{ borderColor: "var(--edge-hot)", background: "var(--void)" }}
            />

            {q.trim() && people.length === 0 && (
              <p className="meta">No one found.</p>
            )}

            <ul className="border-t-2" style={{ borderColor: "var(--edge)" }}>
              {people.map((p) => (
                <li key={p.id} className="border-b-2" style={{ borderColor: "var(--edge)" }}>
                  <button
                    type="button"
                    onClick={() => send(p.id, p.name)}
                    disabled={pending === p.id}
                    className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left disabled:opacity-50"
                  >
                    <Image
                      src={tmdbImage(p.avatarUrl, "w200")}
                      alt=""
                      width={32}
                      height={32}
                      className="poster h-8 w-8 shrink-0 rounded-full object-cover"
                      unoptimized
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="meta block">@{p.username}</span>
                    </span>
                    <span className="meta shrink-0" style={{ color: "var(--blood-ink)" }}>
                      {pending === p.id ? "sending…" : "send"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
