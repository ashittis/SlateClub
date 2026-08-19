"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useSocialStore } from "../../stores/socialStore";

interface Props {
  movieId: string;
  onSubmitted?: () => void;
}

export default function ReviewForm({ movieId, onSubmitted }: Props) {
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { submitReview } = useSocialStore();

  const handleSubmit = async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      await submitReview(movieId, body, spoiler);
      setBody("");
      setSpoiler(false);
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="space-y-2 border p-3"
      style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 500))}
        placeholder="What did you think?"
        rows={3}
        aria-label="Your review"
        className="w-full resize-none border p-2 text-sm outline-none placeholder:text-[var(--faint)]"
        style={{ borderColor: "var(--edge)", background: "var(--void)", color: "var(--chalk)" }}
      />
      <div className="flex items-center justify-between gap-3">
        <label className="meta flex min-h-[44px] items-center gap-2">
          <input
            type="checkbox"
            checked={spoiler}
            onChange={(e) => setSpoiler(e.target.checked)}
          />
          Contains spoilers
        </label>
        <div className="flex items-center gap-3">
          <span className="meta">{body.length}/500</span>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !body.trim()}
          >
            {submitting ? "Posting…" : "Post review"}
          </Button>
        </div>
      </div>
    </div>
  );
}
