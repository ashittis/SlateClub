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
  MAX_FAVOURITE_PEOPLE,
  onboardingApi,
  type OnboardingPerson,
} from "@/lib/api/onboarding";

/** Step 3 — favourite cast and crew. Optional. */
export default function PeopleStep() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { people, addPerson, removePerson, submitPeople, hydrate } = useOnboardingStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const search = useCallback(
    async (q: string) => (await onboardingApi.searchPeople(q)).results,
    [],
  );

  const go = async (save: boolean) => {
    setPending(true);
    try {
      if (save) await submitPeople();
      router.push("/onboarding/preferences");
    } finally {
      setPending(false);
    }
  };

  const full = people.length >= MAX_FAVOURITE_PEOPLE;

  return (
    <StepShell
      title="Directors and actors you follow"
      subtitle={`Whose work you'd watch on name alone. Up to ${MAX_FAVOURITE_PEOPLE}.`}
      footer={
        <NextButton
          onClick={() => go(true)}
          onSkip={() => go(false)}
          pending={pending}
          label={people.length ? `Continue with ${people.length}` : "Continue"}
        />
      }
    >
      <PickerSearch<OnboardingPerson>
        placeholder="Search cast and crew"
        search={search}
        isChosen={(p) => people.some((x) => x.tmdbId === p.tmdbId)}
        onPick={addPerson}
        disabled={full}
        disabledHint={`That's ${MAX_FAVOURITE_PEOPLE} — remove one to swap it out.`}
        renderRow={(p) => (
          <>
            <Image
              src={tmdbImage(p.profilePath, "w200")}
              alt=""
              width={36}
              height={36}
              className="poster shrink-0 rounded-full object-cover"
              unoptimized
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="meta block">{p.knownFor}</span>
            </span>
          </>
        )}
      />

      {people.length > 0 && (
        <section className="mt-6">
          <h2 className="section-label">Your picks · {people.length}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {people.map((p) => (
              <li key={p.tmdbId}>
                <button
                  type="button"
                  onClick={() => removePerson(p.tmdbId)}
                  aria-label={`Remove ${p.name}`}
                  className="flex min-h-[44px] items-center gap-2 border px-2.5 text-sm"
                  style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
                >
                  <Image
                    src={tmdbImage(p.profilePath, "w200")}
                    alt=""
                    width={24}
                    height={24}
                    className="shrink-0 rounded-full object-cover"
                    unoptimized
                  />
                  <span>{p.name}</span>
                  <span style={{ color: "var(--faint)" }}>×</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </StepShell>
  );
}
