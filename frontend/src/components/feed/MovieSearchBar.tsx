"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";

interface TmdbMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number | null;
}

interface UserHit {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

interface Props {
  /** Compact mode trims the input height + caps width — for the desktop top nav. */
  compact?: boolean;
  /** Optional placeholder override. */
  placeholder?: string;
}

/*
  MovieSearchBar — universal search.
  Live results dropdown with two sections:
    - FILMS (TMDB via /api/movies/search)
    - PEOPLE (/api/users/search)
  Click a film result → /film/{tmdbId}; click a user → /profile/{username}.
*/
export default function MovieSearchBar({ compact, placeholder }: Props = {}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const filmsQuery = useQuery<{ results: TmdbMovie[] }>({
    queryKey: ["movie-search", debounced],
    queryFn: () =>
      apiFetch<{ results: TmdbMovie[] }>(
        `/api/movies/search?q=${encodeURIComponent(debounced)}`,
      ),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const peopleQuery = useQuery<{ items: UserHit[] }>({
    queryKey: ["user-search-bar", debounced],
    queryFn: () =>
      apiFetch<{ items: UserHit[] }>(
        `/api/users/search?q=${encodeURIComponent(debounced.replace(/^@/, ""))}&limit=5`,
      ),
    enabled: debounced.length >= 1,
    staleTime: 30_000,
  });

  const films = filmsQuery.data?.results?.slice(0, 6) ?? [];
  const people = peopleQuery.data?.items ?? [];
  const isFetching = filmsQuery.isFetching || peopleQuery.isFetching;
  const showDropdown = open && debounced.length >= 1;
  const empty =
    showDropdown &&
    !isFetching &&
    films.length === 0 &&
    people.length === 0;

  const inputPad = compact ? "py-2 text-xs" : "py-3 text-sm";

  return (
    <div className="relative w-full">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
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
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder={
            placeholder ?? "Films, people, slates… (start with @ for people)"
          }
          className={`w-full rounded-full pl-10 pr-4 focus:outline-none ${inputPad}`}
          style={{
            background: "var(--bg-card)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-primary)",
          }}
        />
        {isFetching && (
          <span
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: "var(--text-faint)" }}
          >
            …
          </span>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 z-30 mt-2 rounded-xl overflow-hidden max-h-[70vh] overflow-y-auto"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7)",
            }}
          >
            {empty && (
              <p
                className="px-4 py-4 text-sm"
                style={{ color: "var(--text-faint)" }}
              >
                No results.
              </p>
            )}

            {people.length > 0 && (
              <>
                <SectionHeader>People</SectionHeader>
                {people.map((u) => (
                  <Link
                    key={u.id}
                    href={`/profile/${u.username}`}
                    className="flex items-center gap-3 px-3 py-2 hover:opacity-90"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
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
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {u.name}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{ color: "var(--text-faint)" }}
                      >
                        @{u.username}
                      </p>
                    </div>
                  </Link>
                ))}
              </>
            )}

            {films.length > 0 && (
              <>
                <SectionHeader>Films</SectionHeader>
                {films.map((m) => (
                  <Link
                    key={m.id}
                    href={`/film/${m.id}`}
                    className="flex items-center gap-3 px-3 py-2 hover:opacity-90"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div
                      className="w-10 aspect-[2/3] rounded shrink-0 overflow-hidden"
                      style={{ background: "var(--bg-elevated)" }}
                    >
                      {m.poster_path && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={tmdbImage(m.poster_path, "w200")}
                          alt={m.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {m.title}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {m.release_date?.slice(0, 4) ?? ""}
                        {m.vote_average
                          ? ` · ${m.vote_average.toFixed(1)}★`
                          : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider"
      style={{ color: "var(--text-faint)" }}
    >
      {children}
    </p>
  );
}
