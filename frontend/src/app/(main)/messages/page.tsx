"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { messageKeys, messagesApi } from "@/lib/api/messages";
import Page from "@/components/layout/Page";

/**
 * The inbox. One list of threads — SlateClub split DMs and film recommendations
 * into two separate inboxes, so a shared film couldn't be replied to.
 */
export default function MessagesPage() {
  const { data, isLoading } = useQuery({
    queryKey: messageKeys.conversations(),
    queryFn: () => messagesApi.conversations(),
  });

  return (
    <Page width="narrow">
      <h1 className="text-2xl">Messages</h1>

      {isLoading && <p className="meta mt-4">Loading…</p>}

      {!isLoading && !data?.length && (
        <div
          className="mt-6 border border-dashed px-4 py-12 text-center"
          style={{ borderColor: "var(--edge)" }}
        >
          <p className="text-sm font-medium">No conversations yet</p>
          <p className="meta mt-1">
            Share a film from its page to start one.
          </p>
        </div>
      )}

      {!!data?.length && (
        <ul className="mt-4 border-t" style={{ borderColor: "var(--edge)" }}>
          {data.map((c) => (
            <li key={c.id} className="border-b" style={{ borderColor: "var(--edge)" }}>
              <Link
                href={`/messages/${c.id}`}
                className="flex min-h-[64px] items-center gap-3 py-2.5"
              >
                <Image
                  src={tmdbImage(c.with.avatarUrl, "w200")}
                  alt=""
                  width={40}
                  height={40}
                  className="poster h-10 w-10 shrink-0 rounded-full object-cover"
                  unoptimized
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium">{c.with.name}</span>
                    <span className="meta shrink-0">@{c.with.username}</span>
                  </span>
                  <span
                    className="mt-0.5 block truncate text-sm"
                    style={{ color: c.unread ? "var(--chalk)" : "var(--xerox)" }}
                  >
                    {c.lastPreview ?? "—"}
                  </span>
                </span>
                {c.unread > 0 && (
                  <span
                    className="meta shrink-0 px-1.5 py-0.5"
                    style={{ background: "var(--blood)", color: "var(--chalk)" }}
                  >
                    {c.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
