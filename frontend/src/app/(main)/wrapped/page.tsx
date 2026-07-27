"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import WrappedStory, { type WrappedData } from "@/components/wrapped/WrappedStory";

export default function WrappedPage() {
  const currentYear = new Date().getFullYear();
  // null = "not chosen yet" → fall back to the newest year with data.
  const [picked, setPicked] = useState<number | null>(null);

  const { data: years } = useQuery<number[]>({
    queryKey: ["wrapped", "years"],
    queryFn: () => apiFetch<number[]>("/api/wrapped/years"),
  });

  const year = picked ?? (years && years.length > 0 ? years[0] : currentYear);
  const setYear = setPicked;

  const { data, isLoading } = useQuery<WrappedData>({
    queryKey: ["wrapped", year],
    queryFn: () => apiFetch<WrappedData>(`/api/wrapped/${year}`),
  });

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  const hasData = data && data.totalFilms > 0;

  return (
    <div className="relative bg-black">
      {/* Year switcher + close */}
      <div className="absolute left-0 right-0 top-0 z-10 mx-auto flex max-w-md items-center justify-between px-4 pt-16">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(years && years.length > 0 ? years : [currentYear]).map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
              style={{
                background: y === year ? "#FF9408" : "rgba(255,255,255,0.12)",
                color: y === year ? "#1a1114" : "rgba(255,255,255,0.8)",
              }}
            >
              {y}
            </button>
          ))}
        </div>
        <Link href="/profile" aria-label="Close" className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      {hasData ? (
        <WrappedStory data={data!} />
      ) : (
        <div className="flex h-[100dvh] flex-col items-center justify-center px-8 text-center">
          <p className="text-lg font-semibold text-white">No films logged in {year}</p>
          <p className="mt-2 text-sm text-white/60">Log some viewings and your Wrapped will fill in.</p>
          <Link href="/home" className="mt-6 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
            Find something to watch
          </Link>
        </div>
      )}
    </div>
  );
}
