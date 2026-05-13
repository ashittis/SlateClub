"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Pill from "@/components/ui/Pill";
import type { PillKind } from "@/lib/design-tokens";

interface Option {
  key: string;
  label: string;
}

interface SwapSheetProps {
  open: boolean;
  title: string;
  kind: PillKind;
  options: Option[];
  selected: string | null;
  onPick: (key: string | null) => void;
  onClose: () => void;
}

/*
  SwapSheet — bottom sheet on mobile, centred dialog on desktop.
  Tapping a pill replaces the active sentence slot. "Any" clears it.
*/
export default function SwapSheet({
  open,
  title,
  kind,
  options,
  selected,
  onPick,
  onClose,
}: SwapSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.55)" }}
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl p-5 lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:right-auto lg:rounded-2xl lg:p-6 lg:max-w-lg lg:w-full"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.08)",
              transform: "translate(0, 0)",
              boxShadow: "0 -24px 60px -8px rgba(0,0,0,0.55)",
            }}
          >
            <div className="lg:hidden mx-auto mb-4 h-1 w-10 rounded-full"
                 style={{ background: "var(--bg-elevated)" }} />
            <div className="flex items-center justify-between mb-4">
              <h3
                className="display text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-xs"
                style={{ color: "var(--text-faint)" }}
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill
                kind="neutral"
                size="sm"
                active={selected === null}
                onClick={() => {
                  onPick(null);
                  onClose();
                }}
              >
                Any
              </Pill>
              {options.map((opt) => (
                <Pill
                  key={opt.key}
                  kind={kind}
                  size="sm"
                  active={opt.key === selected}
                  onClick={() => {
                    onPick(opt.key);
                    onClose();
                  }}
                >
                  {opt.label}
                </Pill>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
