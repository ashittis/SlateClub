"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useAuthStore } from "@/stores/authStore";
import AuthField from "@/components/auth/AuthField";

gsap.registerPlugin(useGSAP);

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

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
          stagger: 0.08,
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
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div ref={root} className="space-y-8">
      <div className="space-y-3">
        <h1
          className="auth-reveal text-5xl font-bold sm:text-6xl"
          style={{
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            letterSpacing: "-0.03em",
            lineHeight: 0.92,
            color: "var(--text-primary)",
          }}
        >
          Welcome
          <br />
          back.
        </h1>
        <p className="auth-reveal text-sm" style={{ color: "var(--text-muted)" }}>
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
              color: "#E79A97",
            }}
          >
            {error}
          </div>
        )}

        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
        />

        <button
          type="submit"
          disabled={submitting}
          className="auth-reveal h-14 w-full rounded-full text-base font-semibold transition active:scale-[0.99] disabled:opacity-60"
          style={{
            background: "linear-gradient(95deg, #FF4D00 0%, #FF9800 100%)",
            boxShadow: "0 0 40px rgba(255,120,0,0.28)",
            color: "#ffffff",
          }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="auth-reveal text-sm" style={{ color: "var(--text-muted)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium" style={{ color: "var(--cta-primary)" }}>
          Create account
        </Link>
      </p>
    </div>
  );
}
