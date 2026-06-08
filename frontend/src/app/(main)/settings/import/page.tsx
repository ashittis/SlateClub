"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";

interface ImportCounts {
  imported: number;
  skipped: number;
  unresolved: number;
}

interface ImportResp {
  ok: boolean;
  totalImported: number;
  message: string;
  counts: {
    ratings: ImportCounts;
    watched: ImportCounts;
    watchlist: ImportCounts;
  };
}

export default function ImportPage() {
  const [ratings, setRatings] = useState<File | null>(null);
  const [watched, setWatched] = useState<File | null>(null);
  const [watchlist, setWatchlist] = useState<File | null>(null);
  const { } = useAuthStore();

  const upload = useMutation<ImportResp, Error, void>({
    mutationFn: async () => {
      const fd = new FormData();
      if (ratings) fd.append("ratings", ratings);
      if (watched) fd.append("watched", watched);
      if (watchlist) fd.append("watchlist", watchlist);
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${base}/api/import/letterboxd`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Import failed (${res.status})`);
      return res.json();
    },
  });

  const ready = ratings || watched || watchlist;

  return (
    <div className="mx-auto max-w-2xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        Import from Letterboxd
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Export your data from Letterboxd → Settings → Import & Export, then
        upload the CSVs here. Each row resolves via TMDB and seeds your taste.
      </p>

      <div
        className="rounded-2xl p-5 space-y-4"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <FileRow
          label="ratings.csv"
          file={ratings}
          onChange={setRatings}
          hint="Star ratings → Slate Ratings."
        />
        <FileRow
          label="watched.csv"
          file={watched}
          onChange={setWatched}
          hint="Logged films → Slate Watch History."
        />
        <FileRow
          label="watchlist.csv"
          file={watchlist}
          onChange={setWatchlist}
          hint="Watchlist → Slate Shelf."
        />

        <button
          onClick={() => upload.mutate()}
          disabled={!ready || upload.isPending}
          className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{
            background: "var(--cta-gradient)",
            color: "var(--bg-screening)",
          }}
        >
          {upload.isPending ? "Importing… (may take a moment)" : "Import"}
        </button>

        {upload.isError && (
          <p className="text-sm" style={{ color: "var(--signal-error)" }}>
            {upload.error.message}
          </p>
        )}

        {upload.data && (
          <div
            className="rounded-xl p-4 space-y-2 text-sm"
            style={{
              background: "rgba(255, 138, 0, 0.10)",
              border: "1px solid rgba(255, 138, 0, 0.35)",
              color: "var(--text-primary)",
            }}
          >
            <p className="font-semibold">{upload.data.message}</p>
            {(["ratings", "watched", "watchlist"] as const).map((k) => {
              const c = upload.data!.counts[k];
              return (
                <p key={k} style={{ color: "var(--text-muted)" }}>
                  {k}: {c.imported} imported · {c.skipped} skipped ·{" "}
                  {c.unresolved} unresolved
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FileRow({
  label,
  file,
  onChange,
  hint,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  hint: string;
}) {
  return (
    <div>
      <label className="block">
        <p
          className="display text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </p>
        <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>
          {hint}
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="block text-xs"
          style={{ color: "var(--text-muted)" }}
        />
      </label>
      {file && (
        <p
          className="text-xs mt-1"
          style={{ color: "var(--cta-primary)" }}
        >
          ✓ {file.name}
        </p>
      )}
    </div>
  );
}
