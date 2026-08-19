"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { blendsApi } from "@/lib/api/collections";

/**
 * Create a Blend.
 *
 * A blend needs two people, so creating one produces a link to send. That is
 * the whole access model — Kaset's follow graph is one-directional, so there's
 * no mutual-friends list to invite from.
 */
export default function CreateBlendPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const blend = await blendsApi.create(title.trim() || "Blend");
      router.push(`/blends/${blend.id}`);
    } catch {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl px-4 pb-16 pt-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">New blend</h1>
      <p className="meta mt-1">
        Combine your taste with someone else&apos;s. You&apos;ll get a link to send them.
      </p>

      <label className="mt-6 block">
        <span className="section-label mb-1.5 block">Name (optional)</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Friday night"
          autoFocus
          className="min-h-[48px] w-full border px-3 text-base"
          style={{ borderColor: "var(--edge-hot)", background: "var(--soot)" }}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 min-h-[52px] w-full border text-base font-semibold disabled:opacity-40"
        style={{
          borderColor: "var(--blood)",
          background: "var(--blood)",
          color: "var(--chalk)",
        }}
      >
        {pending ? "Creating…" : "Create blend"}
      </button>
    </form>
  );
}
