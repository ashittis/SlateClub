"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "@/components/layout/navIcons";

/**
 * The top bar's search field.
 *
 * Search is one of the four primary destinations, and until now the only way to
 * reach it was to navigate there first and then start typing. A persistent
 * field means the thought "I want to log Rang De Basanti" costs one keystroke
 * from anywhere in the app.
 *
 * It submits rather than searching as you type: the /search page owns the live,
 * debounced query. This field's only job is to get you there with your words
 * intact, so the two never race each other over the same URL.
 */
export default function SearchField({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Mirror the URL while you are on /search, so the bar and the page agree
  // after a back/forward. Anywhere else the field resets — carrying a stale
  // query around the app reads as a filter you can't see the effect of.
  const fromUrl = pathname === "/search" ? (params.get("q") ?? "") : "";

  // Adjusted during render rather than in an effect: this is state derived from
  // a prop-like value, and resetting it in useEffect renders the stale query for
  // a frame first. https://react.dev/learn/you-might-not-need-an-effect
  const [value, setValue] = useState(fromUrl);
  const [lastFromUrl, setLastFromUrl] = useState(fromUrl);
  if (fromUrl !== lastFromUrl) {
    setLastFromUrl(fromUrl);
    setValue(fromUrl);
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <form
      role="search"
      onSubmit={submit}
      className={`relative flex items-center ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 flex items-center"
        style={{ color: "var(--faint)" }}
      >
        <SearchIcon />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search films, people, members"
        aria-label="Search Kaset"
        enterKeyHint="search"
        className="pill h-10 w-full border pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-[var(--faint)]"
        style={{
          borderColor: "var(--edge)",
          background: "var(--soot)",
          color: "var(--chalk)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--edge-hot)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--edge)")}
      />
    </form>
  );
}
