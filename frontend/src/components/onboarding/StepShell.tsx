"use client";

import type { ReactNode } from "react";

/**
 * The frame every onboarding step sits in.
 *
 * Mobile: title, body, and a footer that sticks to the bottom so the primary
 * action is always in thumb reach. Desktop: the same column, centred.
 */
export default function StepShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col px-5 pb-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="pb-5 pt-4">
          <h1 className="text-2xl font-bold leading-tight tracking-tight lg:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm" style={{ color: "var(--xerox)" }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col">{children}</div>

        <div
          className="sticky bottom-0 mt-6 border-t-2 pt-3 pb-[env(safe-area-inset-bottom)] lg:static lg:border-0"
          style={{ borderColor: "var(--edge)", background: "var(--void)" }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}
