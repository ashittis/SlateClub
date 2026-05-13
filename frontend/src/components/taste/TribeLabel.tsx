"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import Link from "next/link";

interface TribeData {
  tribe: {
    cluster_id: string;
    name: string;
    weight: number;
    size: number;
  } | null;
}

export default function TribeLabel() {
  const { data } = useQuery<TribeData>({
    queryKey: ["my-tribe"],
    queryFn: () => apiFetch<TribeData>("/api/tribes/my-tribe"),
  });

  if (!data?.tribe) return null;

  return (
    <Link
      href="/tribe"
      className="inline-flex items-center gap-1.5 rounded-full bg-green-glass-15 px-3 py-1 text-xs font-medium text-accent-green transition-colors hover:bg-accent-green/25"
    >
      <span className="h-2 w-2 rounded-full bg-accent-green" />
      {data.tribe.name}
      <span className="text-accent-green/60">· {data.tribe.size} members</span>
    </Link>
  );
}
