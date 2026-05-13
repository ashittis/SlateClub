"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface Props {
  title: string;
  hint?: string;
  href?: string;
  children: ReactNode;
}

export default function Section({ title, hint, href, children }: Props) {
  return (
    <section className="py-6">
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <h2
            className="display text-xl lg:text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>
          {hint && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
              {hint}
            </p>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="text-xs font-medium hover:opacity-80"
            style={{ color: "var(--cta-primary)" }}
          >
            See all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
