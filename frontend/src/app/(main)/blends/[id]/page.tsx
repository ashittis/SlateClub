"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { blendsApi, collectionKeys, type BlendEmptyReason } from "@/lib/api/collections";
import { filmHref } from "@/lib/api/films";
import Page from "@/components/layout/Page";

/**
 * A Blend — what two people should watch together.
 *
 * Picks come from the same evidence pools the film page uses; a film qualifies
 * by surfacing for more than one member. Each shows how many members it was
 * shared by, because that overlap *is* the recommendation.
 */
export default function BlendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [copied, setCopied] = useState(false);

  const { data: blend, isLoading } = useQuery({
    queryKey: collectionKeys.blend(id),
    queryFn: () => blendsApi.detail(id),
    retry: false,
  });

  const { data: picks } = useQuery({
    queryKey: collectionKeys.blendPicks(id),
    queryFn: () => blendsApi.recommendations(id),
    enabled: !!blend?.isMember,
    retry: false,
  });

  const copyInvite = async () => {
    if (!blend?.inviteToken) return;
    const url = `${window.location.origin}/blends/join/${blend.inviteToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is visible below either way.
    }
  };

  if (isLoading) return <p className="meta px-4 py-16">Loading…</p>;
  if (!blend) return <p className="meta px-4 py-16">Blend not found.</p>;

  return (
    <Page>
      <h1 className="text-2xl">{blend.title}</h1>

      <ul className="mt-3 flex flex-wrap items-center gap-2">
        {blend.members.map((m) => (
          <li key={m.id}>
            <Link
              href={`/passport/${m.username}`}
              className="flex min-h-[40px] items-center gap-2 border px-2.5"
              style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
            >
              <Image
                src={tmdbImage(m.avatarUrl, "w200")}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover"
                unoptimized
              />
              <span className="text-sm font-medium">{m.name}</span>
            </Link>
          </li>
        ))}
      </ul>

      {blend.isMember && blend.inviteToken && (
        <div
          className="mt-4 border p-3"
          style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
        >
          <p className="section-label">Invite link</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="meta min-w-0 flex-1 truncate" style={{ color: "var(--chalk)" }}>
              /blends/join/{blend.inviteToken}
            </code>
            <button
              type="button"
              onClick={copyInvite}
              className="min-h-[36px] shrink-0 border px-3 text-sm"
              style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
        </div>
      )}

      <section className="mt-7">
        <h2 className="section-label">What you&apos;d both watch</h2>

        {picks?.reason && <EmptyBlend reason={picks.reason} members={picks.members} />}

        {(picks?.results.length ?? 0) > 0 && (
          <ul className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {picks!.results.map((p) => (
              <li key={p.tmdbId}>
                <Link href={filmHref(p)} className="block">
                  <Image
                    src={tmdbImage(p.posterPath, "w200")}
                    alt={p.title}
                    width={120}
                    height={180}
                    className="poster w-full object-cover"
                    unoptimized
                  />
                  <span className="mt-1 block truncate text-xs font-medium">{p.title}</span>
                  <span className="meta block">shared by {p.sharedBy}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

/** Each empty case has a different cause and a different next step. */
function EmptyBlend({ reason, members }: { reason: BlendEmptyReason; members: number }) {
  const copy: Record<string, { title: string; hint: string }> = {
    waiting_for_members: {
      title: "Waiting for someone to join",
      hint: "Send the invite link above. A blend needs at least two people.",
    },
    no_warm_pools: {
      title: "Not enough to go on yet",
      hint: `Rate a few films you love — that's what a blend is built from. ${members} member(s) so far.`,
    },
    no_overlap: {
      title: "No overlap yet",
      hint: "Your tastes haven't met in the middle. Rate more films and check back.",
    },
  };
  const c = copy[reason ?? ""] ?? copy.no_overlap;

  return (
    <div
      className="mt-2 border border-dashed px-4 py-10 text-center"
      style={{ borderColor: "var(--edge)" }}
    >
      <p className="text-sm font-medium">{c.title}</p>
      <p className="meta mt-1">{c.hint}</p>
    </div>
  );
}
