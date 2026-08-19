"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { messageKeys, messagesApi } from "@/lib/api/messages";
import { filmHref } from "@/lib/api/films";

/**
 * One conversation.
 *
 * A shared film renders as a rich card inline, in date order with everything
 * else — the point of merging the two old systems is that you can send a film
 * and then talk about it in the same place.
 */
export default function ThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: messageKeys.thread(conversationId),
    queryFn: () => messagesApi.thread(conversationId),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [data?.messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await messagesApi.reply(conversationId, text);
      setDraft("");
      queryClient.invalidateQueries({ queryKey: messageKeys.thread(conversationId) });
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
    } finally {
      setSending(false);
    }
  };

  if (isLoading) return <p className="meta px-4 py-16">Loading…</p>;
  if (!data) return <p className="meta px-4 py-16">Conversation not found.</p>;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] w-full max-w-3xl flex-col px-4 lg:px-8">
      <header
        className="flex shrink-0 items-center gap-2.5 border-b-2 py-3"
        style={{ borderColor: "var(--edge)" }}
      >
        <Link href="/messages" className="meta" style={{ color: "var(--blood-ink)" }}>
          ← inbox
        </Link>
        <Link
          href={`/passport/${data.with.username}`}
          className="ml-2 flex min-w-0 items-center gap-2"
        >
          <Image
            src={tmdbImage(data.with.avatarUrl, "w200")}
            alt=""
            width={28}
            height={28}
            className="poster h-7 w-7 shrink-0 rounded-full object-cover"
            unoptimized
          />
          <span className="truncate text-sm font-medium">{data.with.name}</span>
        </Link>
      </header>

      <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
        {data.messages.map((m) => {
          const mine = m.senderId !== data.with.id;
          return (
            <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className="max-w-[80%]">
                {m.sharedFilm && (
                  <Link
                    href={filmHref(m.sharedFilm)}
                    className="mb-1 flex items-center gap-2.5 border p-2"
                    style={{
                      borderColor: "var(--edge)",
                      background: "var(--soot)",
                    }}
                  >
                    <Image
                      src={tmdbImage(m.sharedFilm.posterPath, "w200")}
                      alt=""
                      width={36}
                      height={54}
                      className="poster shrink-0 object-cover"
                      unoptimized
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {m.sharedFilm.title}
                      </span>
                      <span className="meta block">{m.sharedFilm.year ?? "—"}</span>
                    </span>
                  </Link>
                )}
                {m.body && (
                  <p
                    className="border px-2.5 py-1.5 text-sm"
                    style={{
                      borderColor: mine ? "var(--blood)" : "var(--edge)",
                      background: mine ? "var(--blood)" : "var(--soot)",
                      color: mine ? "var(--void)" : "var(--chalk)",
                    }}
                  >
                    {m.body}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        <div ref={endRef} />
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex shrink-0 gap-2 border-t-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        style={{ borderColor: "var(--edge)" }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message"
          className="min-h-[48px] flex-1 border px-3 text-base"
          style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="min-h-[48px] border px-4 text-sm font-semibold disabled:opacity-40"
          style={{
            borderColor: "var(--blood)",
            background: "var(--blood)",
            color: "var(--chalk)",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
