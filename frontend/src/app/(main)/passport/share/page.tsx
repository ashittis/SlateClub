"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { wrappedApi, wrappedKeys } from "@/lib/api/wrapped";
import ShareCard from "@/components/passport/ShareCard";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Passport sharing — pick a month or a year and get a card.
 *
 * The card is a plain element rather than a canvas render: it screenshots
 * cleanly, stays selectable and accessible, and needs no image pipeline.
 */
export default function SharePage() {
  const now = new Date();
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: years } = useQuery({
    queryKey: wrappedKeys.years(),
    queryFn: () => wrappedApi.years(),
  });

  const { data: card, isLoading } = useQuery({
    queryKey: wrappedKeys.card(period, year, month),
    queryFn: () =>
      period === "month"
        ? wrappedApi.monthCard(year, month)
        : wrappedApi.yearCard(year),
  });

  const options = years?.years?.length ? years.years : [now.getFullYear()];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-5 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Share your Passport</h1>
      <p className="meta mt-1">A month or a year of your cinema life.</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["month", "year"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className="min-h-[44px] border px-3 text-sm font-medium capitalize"
            style={{
              borderColor: period === p ? "var(--chalk)" : "var(--edge)",
              background: period === p ? "var(--chalk)" : "var(--soot)",
              color: period === p ? "var(--void)" : "var(--chalk)",
            }}
          >
            {p}
          </button>
        ))}

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="min-h-[44px] border px-2 text-sm"
          style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
        >
          {options.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {period === "month" && (
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="min-h-[44px] border px-2 text-sm"
            style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-6">
        {isLoading && <p className="meta">Loading…</p>}
        {card && <ShareCard data={card} />}
      </div>

      <p className="meta mt-4">
        Screenshot to share, or see the full{" "}
        <Link href={`/passport/wrapped/${year}`} className="prose-link">
          {year} Wrapped
        </Link>
        .
      </p>
    </div>
  );
}
