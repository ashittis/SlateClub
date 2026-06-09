// Shared vocabulary for Shelf Notes and DNF, so the bottom sheets and the
// profile "Saved because:" subtext stay in sync.

export interface ShelfReason {
  key: string;
  label: string;
}

/* Tiny muted quick-tags shown under the note (Notion-tag style, not pills). */
export const SHELF_REASONS: ShelfReason[] = [
  { key: "friend", label: "Friend rec" },
  { key: "slate", label: "Slate rec" },
  { key: "mood", label: "Specific mood" },
  { key: "looks_interesting", label: "Looks interesting" },
  { key: "social_media", label: "Saw on social" },
];

// Includes labels for reason types no longer shown as chips (e.g. similar_movie
// set via the "Reminds you of" autocomplete) so old/derived rows still render.
const SHELF_REASON_LABELS: Record<string, string> = {
  friend: "Recommended by a friend",
  slate: "Recommended by Slate",
  mood: "For a specific mood",
  looks_interesting: "Looks interesting",
  social_media: "Saw on social media",
  heard_good: "Heard good things",
  similar_movie: "Similar to another film",
  custom: "Saved a note",
};

/**
 * The grey provenance line for a shelf card. Prefers the concrete reference
 * (the film it reminds you of / who recommended it) over the generic label.
 */
export function shelfReasonSummary(
  reasonType: string | null | undefined,
  reasonReference: string | null | undefined,
): string | null {
  if (reasonReference) {
    if (reasonType === "similar_movie") return `Reminds you of ${reasonReference}`;
    if (reasonType === "friend") return `Recommended by ${reasonReference}`;
    return reasonReference;
  }
  if (reasonType) return SHELF_REASON_LABELS[reasonType] ?? null;
  return null;
}

// ── DNF ──────────────────────────────────────────────────────

export const DNF_STOPPED_AT: { key: string; label: string }[] = [
  { key: "15min", label: "15 min" },
  { key: "30min", label: "30 min" },
  { key: "1hour", label: "1 hour" },
  { key: "near_end", label: "Near the end" },
];

export const DNF_REASONS: { key: string; label: string }[] = [
  { key: "too_slow", label: "Too slow" },
  { key: "didnt_enjoy", label: "Didn't enjoy" },
  { key: "not_in_mood", label: "Not in the mood" },
  { key: "bad_rec", label: "Bad recommendation" },
  { key: "other", label: "Other" },
];

const DNF_REASON_LABELS: Record<string, string> = Object.fromEntries(
  DNF_REASONS.map((r) => [r.key, r.label]),
);
const DNF_STOPPED_LABELS: Record<string, string> = Object.fromEntries(
  DNF_STOPPED_AT.map((r) => [r.key, r.label]),
);

export const dnfReasonLabel = (key: string | null | undefined): string | null =>
  key ? DNF_REASON_LABELS[key] ?? key : null;
export const dnfStoppedLabel = (key: string | null | undefined): string | null =>
  key ? DNF_STOPPED_LABELS[key] ?? key : null;
