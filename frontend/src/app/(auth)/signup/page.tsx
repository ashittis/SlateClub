"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import Button from "@/components/ui/Button";

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">
          Join SlateClub
        </h1>
        <p className="mt-2 text-sm text-glass-40">
          Create your account to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-accent-red/10 border border-accent-red/20 px-4 py-3 text-sm text-accent-red">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium text-glass-55">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-glass-6 bg-glass-6 px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            placeholder="Your name"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="username" className="block text-sm font-medium text-glass-55">
            Username
          </label>
          <input
            id="username"
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-glass-6 bg-glass-6 px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            placeholder="Pick a username"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-glass-55">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-glass-6 bg-glass-6 px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-glass-55">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-glass-6 bg-glass-6 px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            placeholder="At least 8 characters"
            minLength={8}
          />
        </div>

        <Button
          type="submit"
          disabled={submitting}
          size="lg"
          className="w-full"
        >
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-glass-40">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent-green hover:text-accent-green/80">
          Sign in
        </Link>
      </p>
    </div>
  );
}
