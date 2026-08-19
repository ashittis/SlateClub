"use client";

import { useState } from "react";
import DiaryTab from "./DiaryTab";
import RatingsTab from "./RatingsTab";
import ReviewsTab from "./ReviewsTab";
import WatchlistTab from "./WatchlistTab";
import ListsTab from "./ListsTab";

/**
 * The Library tab frame — the user's personal cinema record (KASET.md §8).
 *
 * Tabs are a horizontal rule with the active one underlined in tape red: the
 * early-2000s treatment, and it survives on a narrow phone without collapsing
 * into a menu.
 */
const TABS = ["Diary", "Ratings", "Reviews", "Watchlist", "Lists"] as const;
type Tab = (typeof TABS)[number];

export default function LibraryTabs() {
  const [active, setActive] = useState<Tab>("Diary");

  return (
    <div className="mt-5">
      <div
        role="tablist"
        aria-label="Library sections"
        className="no-scrollbar flex gap-1 overflow-x-auto border-b-2"
        style={{ borderColor: "var(--edge)" }}
      >
        {TABS.map((t) => {
          const on = t === active;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t)}
              className="relative min-h-[44px] whitespace-nowrap px-3 text-sm font-medium"
              style={{ color: on ? "var(--chalk)" : "var(--xerox)" }}
            >
              {t}
              <span
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-[2px]"
                style={{ background: on ? "var(--blood)" : "transparent" }}
              />
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={active}>
        {active === "Diary" && <DiaryTab />}
        {active === "Ratings" && <RatingsTab />}
        {active === "Reviews" && <ReviewsTab />}
        {active === "Watchlist" && <WatchlistTab />}
        {active === "Lists" && <ListsTab />}
      </div>
    </div>
  );
}
