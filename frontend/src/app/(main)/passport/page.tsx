"use client";

import { useQuery } from "@tanstack/react-query";
import { passportApi, passportKeys } from "@/lib/api/passport";
import PassportView from "@/components/passport/PassportView";

/** Your own Passport. Reached through the avatar, never primary nav. */
export default function MyPassportPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: passportKeys.me(),
    queryFn: () => passportApi.me(),
  });

  if (isLoading) return <p className="meta px-4 py-16">Loading…</p>;
  if (error || !data) {
    return (
      <p className="px-4 py-16 text-sm" style={{ color: "var(--xerox)" }}>
        Sign in to see your passport.
      </p>
    );
  }
  return <PassportView passport={data} />;
}
