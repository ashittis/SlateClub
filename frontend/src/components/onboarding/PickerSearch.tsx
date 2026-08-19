"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Debounced search field + result list, shared by the films and cast/crew steps.
 *
 * Generic over the item so each step keeps its own row rendering — a film row
 * wants a poster and a year, a person row wants a headshot and a department.
 */
export default function PickerSearch<T>({
  placeholder,
  search,
  renderRow,
  isChosen,
  onPick,
  disabled = false,
  disabledHint,
}: {
  placeholder: string;
  search: (q: string) => Promise<T[]>;
  renderRow: (item: T) => ReactNode;
  isChosen: (item: T) => boolean;
  onPick: (item: T) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await search(term);
        if (!cancelled) setResults(r);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, search]);

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        className="min-h-[48px] w-full border px-3 text-base outline-none disabled:opacity-50"
        style={{
          borderColor: "var(--edge-hot)",
          background: "var(--soot)",
          color: "var(--chalk)",
        }}
      />

      {disabled && disabledHint && (
        <p className="meta mt-2">{disabledHint}</p>
      )}

      {!disabled && q.trim() && (
        <div className="mt-3">
          {loading && results.length === 0 ? (
            <p className="meta">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--xerox)" }}>
              Nothing found.
            </p>
          ) : (
            <ul className="border-t-2" style={{ borderColor: "var(--edge)" }}>
              {results.map((item, i) => {
                const chosen = isChosen(item);
                return (
                  <li key={i} className="border-b-2" style={{ borderColor: "var(--edge)" }}>
                    <button
                      type="button"
                      onClick={() => !chosen && onPick(item)}
                      disabled={chosen}
                      className="flex min-h-[56px] w-full items-center gap-3 py-2 text-left disabled:opacity-45"
                    >
                      {renderRow(item)}
                      <span
                        className="meta ml-auto shrink-0 pl-2"
                        style={{ color: chosen ? "var(--acid)" : "var(--blood-ink)" }}
                      >
                        {chosen ? "added" : "add"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
