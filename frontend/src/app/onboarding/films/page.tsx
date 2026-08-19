"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import StepShell from "@/components/onboarding/StepShell";
import NextButton from "@/components/onboarding/NextButton";
import PickerSearch from "@/components/onboarding/PickerSearch";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { tmdbImage } from "@/lib/api/client";
import {
  MAX_FAVOURITE_FILMS,
  onboardingApi,
  type OnboardingFilm,
} from "@/lib/api/onboarding";

/** Step 2 — favourite films. Optional, and capped so it stays a shortlist. */
export default function FilmsStep() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { films, addFilm, removeFilm, submitFilms, hydrate } = useOnboardingStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const search = useCallback(
    async (q: string) => (await onboardingApi.searchFilms(q)).results,
    [],
  );

  const go = async (save: boolean) => {
    setPending(true);
    try {
      if (save) await submitFilms();
      router.push("/onboarding/people");
    } finally {
      setPending(false);
    }
  };

  const full = films.length >= MAX_FAVOURITE_FILMS;

  return (
    <StepShell
      title="Films you love"
      subtitle={`The ones that say something about you. Up to ${MAX_FAVOURITE_FILMS}.`}
      footer={
        <NextButton
          onClick={() => go(true)}
          onSkip={() => go(false)}
          pending={pending}
          label={films.length ? `Continue with ${films.length}` : "Continue"}
        />
      }
    >
      <PickerSearch<OnboardingFilm>
        placeholder="Search films"
        search={search}
        isChosen={(f) => films.some((x) => x.tmdbId === f.tmdbId)}
        onPick={addFilm}
        disabled={full}
        disabledHint={`That's ${MAX_FAVOURITE_FILMS} — remove one to swap it out.`}
        renderRow={(f) => (
          <>
            <Image
              src={tmdbImage(f.posterPath, "w200")}
              alt=""
              width={32}
              height={48}
              className="poster shrink-0 object-cover"
              unoptimized
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{f.title}</span>
              <span className="meta block">{f.year ?? "—"}</span>
            </span>
          </>
        )}
      />

      {films.length > 0 && (
        <section className="mt-6">
          <h2 className="section-label">Your picks · {films.length}</h2>
          <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {films.map((f) => (
              <li key={f.tmdbId}>
                <button
                  type="button"
                  onClick={() => removeFilm(f.tmdbId)}
                  aria-label={`Remove ${f.title}`}
                  className="group relative block w-full"
                >
                  <Image
                    src={tmdbImage(f.posterPath, "w200")}
                    alt={f.title}
                    width={100}
                    height={150}
                    className="poster w-full object-cover"
                    unoptimized
                  />
                  <span
                    className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center text-xs font-bold"
                    style={{ background: "var(--blood)", color: "var(--chalk)" }}
                  >
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </StepShell>
  );
}
