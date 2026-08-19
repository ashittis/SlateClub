"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { watchlistsApi } from "@/lib/api/collections";

/** Create a named watchlist — a curated, ordered collection. */
export default function CreateWatchlistPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const wl = await watchlistsApi.create(
        title.trim(),
        description.trim() || undefined,
        isPrivate ? "private" : "public",
      );
      router.push(`/library/watchlists/${wl.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that list.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl px-4 pb-16 pt-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">New watchlist</h1>
      <p className="meta mt-1">A collection you curate and order yourself.</p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="section-label mb-1.5 block">Name</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="1970s paranoia"
            autoFocus
            className="min-h-[48px] w-full border px-3 text-base"
            style={{ borderColor: "var(--edge-hot)", background: "var(--soot)" }}
          />
        </label>

        <label className="block">
          <span className="section-label mb-1.5 block">Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border p-3 text-sm"
            style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
          />
        </label>

        <label
          className="flex min-h-[48px] cursor-pointer items-center gap-3 border px-3"
          style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
        >
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="h-5 w-5 accent-[var(--blood)]"
          />
          <span className="text-sm">Keep this list private</span>
        </label>

        {error && <p className="text-sm" style={{ color: "var(--signal-error)" }}>{error}</p>}

        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="min-h-[52px] w-full border text-base font-semibold disabled:opacity-40"
          style={{
            borderColor: "var(--blood)",
            background: "var(--blood)",
            color: "var(--chalk)",
          }}
        >
          {pending ? "Creating…" : "Create list"}
        </button>
      </div>
    </form>
  );
}
