"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOnboardingStore } from "@/stores/onboardingStore";

export default function WelcomePage() {
  const router = useRouter();
  const { setStep, markWelcomed } = useOnboardingStore();

  useEffect(() => {
    setStep(1);
    // Best-effort — fire-and-forget. The user shouldn't wait on this.
    markWelcomed().catch(() => {});
  }, [setStep, markWelcomed]);

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ background: "var(--bg-screening)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.0, ease: "easeOut" }}
        className="w-full max-w-md text-center"
      >
        <p
          className="text-xs uppercase tracking-[0.3em] mb-8"
          style={{ color: "var(--text-faint)" }}
        >
          Tune your taste
        </p>
        <h1
          className="display text-3xl lg:text-5xl font-bold leading-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Before we find your films —<br />
          let&apos;s find your taste.
        </h1>
        <p className="mt-6 text-base" style={{ color: "var(--text-muted)" }}>
          8 quick steps. No wrong answers.
        </p>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          onClick={() => router.push("/onboarding/languages")}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="mt-12 px-10 py-3.5 rounded-full text-sm font-semibold"
          style={{
            background: "var(--cta-primary)",
            color: "var(--bg-screening)",
            boxShadow: "0 16px 40px -12px rgba(92,165,114,0.55)",
          }}
        >
          Let&apos;s go →
        </motion.button>
      </motion.div>
    </div>
  );
}
