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
    diary: ImportCounts;
    watched: ImportCounts;
    watchlist: ImportCounts;
  };
}

export default function ImportPage() {
  const [ratings, setRatings] = useState<File | null>(null);
  const [diary, setDiary] = useState<File | null>(null);
  const [watched, setWatched] = useState<File | null>(null);
  const [watchlist, setWatchlist] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const { } = useAuthStore();

  const upload = useMutation<ImportResp, Error, void>({
    mutationFn: async () => {
      const fd = new FormData();
      if (ratings) fd.append("ratings", ratings);
      if (diary) fd.append("diary", diary);
      if (watched) fd.append("watched", watched);
      if (watchlist) fd.append("watchlist", watchlist);
      fd.append("visibility", isPrivate ? "private" : "public");
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

  const ready = ratings || diary || watched || watchlist;

  return (
    <div className="mx-auto max-w-2xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-1"
        style={{ color: "var(--chalk)" }}
      >
        Import from Letterboxd
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--xerox)" }}>
        Export your data from Letterboxd → Settings → Import & Export, then
        upload the CSVs here. Each row resolves via TMDB and seeds your taste.
      </p>

      <div
        className="rounded-2xl p-5 space-y-4"
        style={{
          background: "var(--soot)",
          border: "1px solid var(--edge)",
        }}
      >
        <FileRow
          label="diary.csv"
          file={diary}
          onChange={setDiary}
          hint="Your dated viewings & rewatches → fills your Diary and Wrapped for past years. The one that matters most."
        />
        <FileRow
          label="ratings.csv"
          file={ratings}
          onChange={setRatings}
          hint="Star ratings → your ratings."
        />
        <FileRow
          label="watched.csv"
          file={watched}
          onChange={setWatched}
          hint="Logged films (undated) → used only for films not in your diary."
        />
        <FileRow
          label="watchlist.csv"
          file={watchlist}
          onChange={setWatchlist}
          hint="Watchlist → your shelf."
        />

        {/* Privacy — importing years of history is the moment this matters. */}
        <label
          className="flex items-center gap-3 rounded-xl p-3 cursor-pointer"
          style={{ background: "var(--soot)", border: "1px solid var(--edge)" }}
        >
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm" style={{ color: "var(--chalk)" }}>
            Import as private
            <span className="ml-1" style={{ color: "var(--faint)" }}>
              — only you see these viewings; they still count in your Wrapped.
            </span>
          </span>
        </label>

        <button
          onClick={() => upload.mutate()}
          disabled={!ready || upload.isPending}
          className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{
            background: "var(--blood)",
            color: "var(--void)",
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
              color: "var(--chalk)",
            }}
          >
            <p className="font-semibold">{upload.data.message}</p>
            {(["diary", "ratings", "watched", "watchlist"] as const).map((k) => {
              const c = upload.data!.counts[k];
              return (
                <p key={k} style={{ color: "var(--xerox)" }}>
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
          style={{ color: "var(--chalk)" }}
        >
          {label}
        </p>
        <p className="text-xs mb-2" style={{ color: "var(--faint)" }}>
          {hint}
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="block text-xs"
          style={{ color: "var(--xerox)" }}
        />
      </label>
      {file && (
        <p
          className="text-xs mt-1"
          style={{ color: "var(--blood-ink)" }}
        >
          ✓ {file.name}
        </p>
      )}
    </div>
  );
}
