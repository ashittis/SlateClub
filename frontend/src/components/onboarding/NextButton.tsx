"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface NextButtonProps {
  enabled: boolean;
  loading?: boolean;
  onClick: () => void;
  children?: ReactNode;
}

export default function NextButton({
  enabled,
  loading,
  onClick,
  children = "Next",
}: NextButtonProps) {
  const disabled = !enabled || loading;
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all duration-200"
      style={{
        background: !disabled ? "var(--cta-gradient)" : "var(--bg-elevated)",
        color: !disabled ? "var(--bg-screening)" : "var(--text-faint)",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: !disabled
          ? "0 12px 28px -10px rgba(255, 138, 0, 0.45)"
          : "none",
      }}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2 justify-center">
          <motion.span
            className="inline-block w-4 h-4 border-2 rounded-full"
            style={{
              borderColor: "var(--bg-screening)",
              borderTopColor: "transparent",
            }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
          />
          Saving…
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}
