"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { passportApi, passportKeys } from "@/lib/api/passport";
import PassportView from "@/components/passport/PassportView";

/**
 * Someone else's Passport.
 *
 * Same component as your own — the backend returns one shape and enforces
 * privacy, so a private passport arrives as a 403 rather than a thinner payload
 * this page would have to defensively interpret.
 */
export default function UserPassportPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: passportKeys.user(username),
    queryFn: () => passportApi.byUsername(username),
    retry: false,
  });

  if (isLoading) return <p className="meta px-4 py-16">Loading…</p>;
  if (error) {
    const message = error instanceof Error ? error.message : "";
    const isPrivate = message.toLowerCase().includes("private");
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-sm font-medium">
          {isPrivate ? "This passport is private" : "No such passport"}
        </p>
        <p className="meta mt-1">
          {isPrivate
            ? "Its owner only shares it with people they've chosen."
            : `We couldn't find @${username}.`}
        </p>
      </div>
    );
  }
  if (!data) return null;
  return <PassportView passport={data} />;
}
