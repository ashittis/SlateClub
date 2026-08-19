"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useAuthStore } from "@/stores/authStore";
import { tmdbImage } from "@/lib/api/client";

/**
 * Step 5 — confirm and enter.
 *
 * Reflects back what the user actually gave us. Onboarding is a trade: they
 * spent a minute, so the payoff should be visible before they're dropped into
 * an empty app.
 */
export default function ReadyStep() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { languages, films, people, hydrate, complete } = useOnboardingStore();
  const fetchUser = useAuthStore((s) => s.fetchUser);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const enter = async () => {
    setPending(true);
    try {
      await complete();
      // Refresh the session so `onboarded` is current before we navigate.
      await fetchUser();
      router.replace("/home");
    } finally {
      setPending(false);
    }
  };

  return (
    <StepShell
      title="You're set"
      subtitle="Here's what Kaset knows so far. You can change any of it in Settings."
      footer={<NextButton onClick={enter} pending={pending} label="Start logging" />}
    >
      <dl className="border-t-2" style={{ borderColor: "var(--edge)" }}>
        <Row label="Languages">
          {languages.length ? languages.join(", ").toUpperCase() : "—"}
        </Row>
        <Row label="Favourite films">{films.length || "—"}</Row>
        <Row label="Cast & crew">{people.length || "—"}</Row>
      </dl>

      {films.length > 0 && (
        <ul className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {films.map((f) => (
            <li key={f.tmdbId}>
              <Image
                src={tmdbImage(f.posterPath, "w200")}
                alt={f.title}
                width={100}
                height={150}
                className="poster w-full object-cover"
                unoptimized
              />
            </li>
          ))}
        </ul>
      )}

      <p className="meta mt-6">
        Next: search a film and log it. That&apos;s the whole idea.
      </p>
    </StepShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between border-b-2 py-3"
      style={{ borderColor: "var(--edge)" }}
    >
      <dt className="text-sm" style={{ color: "var(--xerox)" }}>
        {label}
      </dt>
      <dd className="meta" style={{ color: "var(--chalk)" }}>
        {children}
      </dd>
    </div>
  );
}
