"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useAuthStore } from "@/stores/authStore";
import AuthField from "@/components/auth/AuthField";

gsap.registerPlugin(useGSAP);

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".auth-reveal", {
          y: 20,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.07,
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup({ name, username, email, password });
      router.replace("/onboarding/languages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div ref={root} className="space-y-7">
      <div className="space-y-3">
        <h1
          className="auth-reveal text-4xl sm:text-5xl"
          style={{
            fontFamily: "var(--font-shoulders), system-ui, sans-serif",
            letterSpacing: "-0.03em",
            lineHeight: 0.92,
            color: "var(--chalk)",
          }}
        >
          Track.
          <br />
          Discover.
          <br />
          Remember.
        </h1>
        <p className="auth-reveal text-sm" style={{ color: "var(--xerox)" }}>
          The home for people who love movies.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div
            className="auth-reveal rounded-xl px-4 py-3 text-sm"
            style={{
              background: "rgba(196,113,110,0.12)",
              border: "1px solid rgba(196,113,110,0.3)",
              color: "var(--signal-error)",
            }}
          >
            {error}
          </div>
        )}

        <AuthField id="name" label="Name" type="text" autoComplete="name" value={name} onChange={setName} placeholder="Your name" />
        <AuthField id="username" label="Username" type="text" autoComplete="username" value={username} onChange={setUsername} placeholder="Pick a username" />
        <AuthField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <AuthField id="password" label="Password" type="password" autoComplete="new-password" value={password} onChange={setPassword} placeholder="At least 8 characters" minLength={8} />

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 min-h-[52px] w-full border text-base font-semibold transition disabled:opacity-40"
          style={{
            background: "var(--blood)",
            borderColor: "var(--blood)",
            color: "var(--chalk)",
          }}
        >
          {submitting ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="auth-reveal text-sm" style={{ color: "var(--xerox)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-medium" style={{ color: "var(--blood-ink)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
