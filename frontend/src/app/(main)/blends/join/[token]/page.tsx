"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { blendsApi } from "@/lib/api/collections";

/** Joining by link — the token is the whole access model. */
export default function JoinBlendPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    blendsApi
      .join(token)
      .then((b) => {
        if (!cancelled) router.replace(`/blends/${b.id}`);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "That link isn't valid.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      {error ? (
        <>
          <p className="text-sm font-medium">Couldn&apos;t join that blend</p>
          <p className="meta mt-1">{error}</p>
        </>
      ) : (
        <p className="meta">Joining…</p>
      )}
    </div>
  );
}
