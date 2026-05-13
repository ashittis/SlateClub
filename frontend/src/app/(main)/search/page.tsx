"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, tmdbImage } from "@/lib/api";

type Tab = "films" | "people" | "slates";

interface TmdbMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number | null;
}

interface UserResult {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
}

interface SlateCard {
  id: string;
  title: string;
  description: string | null;
  filmCount: number;
  saveCount: number;
  creator: { id: string; name: string; username: string } | null;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "films", label: "Films" },
  { key: "people", label: "People" },
  { key: "slates", label: "Slates" },
];

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  // Detect @-prefix as a hint to switch to People.
  const [tab, setTab] = useState<Tab>("films");
  const debounced = useDebounce(query.trim(), 300);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-switch to People when the user starts with @, but only if they
  // haven't manually picked another tab during this session.
  const userPickedTab = useRef(false);
  useEffect(() => {
    if (!userPickedTab.current && query.startsWith("@")) {
      setTab("people");
    }
  }, [query]);

  const films = useQuery<{ results: TmdbMovie[] }>({
    queryKey: ["search-films", debounced],
    queryFn: () =>
      apiFetch(`/api/movies/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2 && tab === "films",
  });

  const people = useQuery<{ items: UserResult[] }>({
    queryKey: ["search-people", debounced],
    queryFn: () =>
      apiFetch(
        `/api/users/search?q=${encodeURIComponent(debounced.replace(/^@/, ""))}`,
      ),
    enabled: debounced.length >= 1 && tab === "people",
  });

  const slatesAll = useQuery<{ items: SlateCard[] }>({
    queryKey: ["search-slates", debounced],
    queryFn: () => apiFetch("/api/slates/featured"),
    enabled: debounced.length >= 2 && tab === "slates",
  });
  const slateMatches = (slatesAll.data?.items ?? []).filter((s) =>
    `${s.title} ${s.description ?? ""}`
      .toLowerCase()
      .includes(debounced.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-4"
        style={{ color: "var(--text-primary)" }}
      >
        Search
      </h1>

      <div className="relative mb-5">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5"
          style={{ color: "var(--text-faint)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Films, people, slates… (start with @ for people)"
          className="w-full rounded-full pl-11 pr-4 py-3 text-sm focus:outline-none"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Tabs */}
      <div
        className="inline-flex rounded-full p-1 gap-1 mb-6"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                userPickedTab.current = true;
                setTab(t.key);
              }}
              className="px-4 py-1.5 text-xs font-semibold rounded-full"
              style={{
                background: active ? "var(--text-primary)" : "transparent",
                color: active ? "var(--bg-screening)" : "var(--text-muted)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {!debounced && (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Start typing to search.
        </p>
      )}

      {tab === "films" && debounced && (
        <FilmsResults
          isLoading={films.isLoading}
          items={films.data?.results ?? []}
          query={debounced}
        />
      )}
      {tab === "people" && debounced && (
        <PeopleResults
          isLoading={people.isLoading}
          items={people.data?.items ?? []}
          query={debounced}
        />
      )}
      {tab === "slates" && debounced && (
        <SlatesResults
          isLoading={slatesAll.isLoading}
          items={slateMatches}
          query={debounced}
        />
      )}
    </div>
  );
}

function FilmsResults({
  isLoading,
  items,
  query,
}: {
  isLoading: boolean;
  items: TmdbMovie[];
  query: string;
}) {
  if (isLoading) return <GridSkeleton />;
  if (items.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: "var(--text-faint)" }}>
        No films found for &ldquo;{query}&rdquo;.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((m) => (
        <Link key={m.id} href={`/film/${m.id}`} className="group flex flex-col gap-2">
          <div
            className="relative aspect-[2/3] overflow-hidden rounded-lg"
            style={{ background: "var(--bg-elevated)" }}
          >
            {m.poster_path && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tmdbImage(m.poster_path, "w300")}
                alt={m.title}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            )}
          </div>
          <p
            className="truncate text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {m.title}
          </p>
          {m.release_date && (
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              {m.release_date.slice(0, 4)}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}

function PeopleResults({
  isLoading,
  items,
  query,
}: {
  isLoading: boolean;
  items: UserResult[];
  query: string;
}) {
  if (isLoading)
    return (
      <p className="text-sm" style={{ color: "var(--text-faint)" }}>
        Loading…
      </p>
    );
  if (items.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: "var(--text-faint)" }}>
        No people match &ldquo;{query}&rdquo;.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((u) => (
        <Link
          key={u.id}
          href={`/profile/${u.username}`}
          className="flex items-center gap-3 rounded-xl p-3 hover:opacity-95"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{
              background: "var(--cta-primary)",
              color: "var(--bg-screening)",
            }}
          >
            {u.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={u.avatarUrl}
                alt={u.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              u.name[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {u.name}
            </p>
            <p
              className="text-xs truncate"
              style={{ color: "var(--text-faint)" }}
            >
              @{u.username}
              {u.bio ? ` · ${u.bio}` : ""}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function SlatesResults({
  isLoading,
  items,
  query,
}: {
  isLoading: boolean;
  items: SlateCard[];
  query: string;
}) {
  if (isLoading)
    return (
      <p className="text-sm" style={{ color: "var(--text-faint)" }}>
        Loading…
      </p>
    );
  if (items.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: "var(--text-faint)" }}>
        No slates match &ldquo;{query}&rdquo;.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((s) => (
        <Link
          key={s.id}
          href={`/slates/${s.id}`}
          className="block rounded-xl p-4"
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <p
            className="display text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {s.title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
            {s.creator?.name ?? "—"} · {s.filmCount} film
            {s.filmCount === 1 ? "" : "s"}
            {s.saveCount > 0 ? ` · ♡ ${s.saveCount}` : ""}
          </p>
          {s.description && (
            <p
              className="text-xs mt-2 line-clamp-2"
              style={{ color: "var(--text-muted)" }}
            >
              {s.description}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div
            className="aspect-[2/3] animate-pulse rounded-lg"
            style={{ background: "var(--bg-card)" }}
          />
          <div
            className="h-4 w-3/4 animate-pulse rounded"
            style={{ background: "var(--bg-card)" }}
          />
        </div>
      ))}
    </div>
  );
}
