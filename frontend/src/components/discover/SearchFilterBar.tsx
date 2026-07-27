"use client";

import Pill from "@/components/ui/Pill";

/*
  SearchFilterBar — dropdown/toggle chips that narrow film results. Only the
  dimensions the search payload actually carries are wired (Type, Year) so the
  controls never lie about filtering; Language/Genre/Runtime are surfaced as
  the browse tiles instead (GenreMoodTileGrid).
*/

export type TitleType = "all" | "movie" | "tv";

export interface SearchFilters {
  type: TitleType;
  decade: string; // "all" | "2020" | "2010" | ...
}

export const DEFAULT_FILTERS: SearchFilters = { type: "all", decade: "all" };

const DECADES = ["2020", "2010", "2000", "1990", "1980"];

interface Props {
  value: SearchFilters;
  onChange: (f: SearchFilters) => void;
}

export default function SearchFilterBar({ value, onChange }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Pill
        kind="neutral"
        size="sm"
        active={value.type === "all"}
        onClick={() => onChange({ ...value, type: "all" })}
      >
        All
      </Pill>
      <Pill
        kind="genre"
        size="sm"
        active={value.type === "movie"}
        onClick={() => onChange({ ...value, type: "movie" })}
      >
        Films
      </Pill>
      <Pill
        kind="genre"
        size="sm"
        active={value.type === "tv"}
        onClick={() => onChange({ ...value, type: "tv" })}
      >
        Series
      </Pill>

      <span className="mx-1 h-4 w-px" style={{ background: "rgba(255,255,255,0.12)" }} />

      <Pill
        kind="era"
        size="sm"
        active={value.decade === "all"}
        onClick={() => onChange({ ...value, decade: "all" })}
      >
        Any year
      </Pill>
      {DECADES.map((d) => (
        <Pill
          key={d}
          kind="era"
          size="sm"
          active={value.decade === d}
          onClick={() => onChange({ ...value, decade: d })}
        >
          {d}s
        </Pill>
      ))}
    </div>
  );
}

/** Apply the active filters to a list of hits carrying { mediaType, year }. */
export function applyFilters<
  T extends { mediaType?: string | null; year?: number | string | null },
>(items: T[], f: SearchFilters): T[] {
  return items.filter((it) => {
    if (f.type !== "all" && (it.mediaType ?? "movie") !== f.type) return false;
    if (f.decade !== "all") {
      const start = parseInt(f.decade, 10);
      const yr = typeof it.year === "string" ? parseInt(it.year, 10) : it.year;
      if (!yr || Number.isNaN(yr) || yr < start || yr >= start + 10) return false;
    }
    return true;
  });
}
