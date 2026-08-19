"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { collectionKeys, watchlistsApi } from "@/lib/api/collections";
import { filmHref } from "@/lib/api/films";

/**
 * A named watchlist.
 *
 * Order is the point — it's the user's editorial arrangement, so reordering is
 * a first-class action rather than a hidden setting. Moves send the whole
 * resulting order, which keeps them idempotent.
 */
export default function WatchlistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: collectionKeys.watchlist(id),
    queryFn: () => watchlistsApi.detail(id),
    retry: false,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: collectionKeys.watchlist(id) });

  const move = async (tmdbId: number, delta: number) => {
    if (!data || busy) return;
    const order = data.films.map((f) => f.tmdbId);
    const from = order.indexOf(tmdbId);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    order.splice(to, 0, ...order.splice(from, 1));
    setBusy(true);
    try {
      await watchlistsApi.reorder(id, order);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeFilm = async (tmdbId: number) => {
    setBusy(true);
    try {
      await watchlistsApi.removeFilm(id, tmdbId);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const deleteList = async () => {
    await watchlistsApi.remove(id);
    router.push("/library");
  };

  if (isLoading) return <p className="meta px-4 py-16">Loading…</p>;
  if (error) {
    const isPrivate = (error instanceof Error ? error.message : "").toLowerCase().includes("private");
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-sm font-medium">
          {isPrivate ? "This list is private" : "List not found"}
        </p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-5 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold leading-tight tracking-tight">{data.title}</h1>
        {data.description && <p className="mt-1 text-sm">{data.description}</p>}
        <p className="meta mt-1">
          {data.films.length} {data.films.length === 1 ? "film" : "films"}
          {" · "}
          {data.isOwner ? data.visibility : `by @${data.owner.username}`}
        </p>
      </header>

      {data.films.length === 0 ? (
        <div
          className="mt-6 border border-dashed px-4 py-12 text-center"
          style={{ borderColor: "var(--edge)" }}
        >
          <p className="text-sm font-medium">Nothing in this list yet</p>
          <p className="meta mt-1">Add films from their pages.</p>
          <Link
            href="/search"
            className="mt-4 inline-flex min-h-[44px] items-center border px-4 text-sm font-semibold"
            style={{
              borderColor: "var(--blood)",
              background: "var(--blood)",
              color: "var(--chalk)",
            }}
          >
            Find a film
          </Link>
        </div>
      ) : (
        <ol className="mt-4 border-t-2" style={{ borderColor: "var(--edge)" }}>
          {data.films.map((f, i) => (
            <li
              key={f.tmdbId}
              className="flex items-center gap-3 border-b-2 py-2.5"
              style={{ borderColor: "var(--edge)" }}
            >
              <span className="meta w-5 shrink-0 text-right">{i + 1}</span>
              <Link href={filmHref(f)} className="shrink-0">
                <Image
                  src={tmdbImage(f.posterPath, "w200")}
                  alt=""
                  width={36}
                  height={54}
                  className="poster object-cover"
                  unoptimized
                />
              </Link>
              <Link href={filmHref(f)} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{f.title}</span>
                <span className="meta block">{f.year ?? "—"}</span>
              </Link>

              {data.isOwner && (
                <span className="flex shrink-0 items-center gap-1">
                  <OrderButton label="Move up" disabled={i === 0 || busy} onClick={() => move(f.tmdbId, -1)}>
                    ↑
                  </OrderButton>
                  <OrderButton
                    label="Move down"
                    disabled={i === data.films.length - 1 || busy}
                    onClick={() => move(f.tmdbId, 1)}
                  >
                    ↓
                  </OrderButton>
                  <OrderButton label="Remove" disabled={busy} onClick={() => removeFilm(f.tmdbId)}>
                    ×
                  </OrderButton>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {data.isOwner && (
        <button
          type="button"
          onClick={deleteList}
          className="meta mt-6"
          style={{ color: "var(--blood-ink)" }}
        >
          delete this list
        </button>
      )}
    </div>
  );
}

function OrderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-9 items-center justify-center border text-sm disabled:opacity-30"
      style={{ borderColor: "var(--edge)", color: "var(--xerox)" }}
    >
      {children}
    </button>
  );
}
