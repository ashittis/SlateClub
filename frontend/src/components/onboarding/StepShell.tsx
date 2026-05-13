"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface StepShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}

/*
  StepShell — common scaffold for every onboarding step.
  Mobile: title + body + sticky footer button.
  Desktop: centred max-w-3xl column with extra breathing room.
*/
export default function StepShell({
  title,
  subtitle,
  children,
  footer,
}: StepShellProps) {
  return (
    <div className="flex-1 flex flex-col px-5 pb-8 lg:px-10">
      <div className="mx-auto w-full max-w-3xl flex-1 flex flex-col">
        <motion.div
          className="pt-4 pb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <h1
            className="display text-3xl lg:text-4xl font-bold leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-2 text-sm lg:text-base"
              style={{ color: "var(--text-muted)" }}
            >
              {subtitle}
            </p>
          )}
        </motion.div>

        <motion.div
          className="flex-1 flex flex-col"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        >
          {children}
        </motion.div>

        <div className="mt-6 sticky bottom-3 lg:static lg:mt-8">{footer}</div>
      </div>
    </div>
  );
}
