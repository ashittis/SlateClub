"use client";

import { useState } from "react";
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
    <div className="space-y-2 rounded-lg bg-glass-6 p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 500))}
        placeholder="What did you think?"
        rows={3}
        className="w-full resize-none rounded bg-glass-8 p-2 text-sm text-text-primary placeholder:text-glass-15 focus:outline-none focus:ring-1 focus:ring-accent-green"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-glass-40">
          <input
            type="checkbox"
            checked={spoiler}
            onChange={(e) => setSpoiler(e.target.checked)}
            className="rounded"
          />
          Contains spoilers
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-subtle">{body.length}/500</span>
          <button
            onClick={handleSubmit}
            disabled={submitting || !body.trim()}
            className="rounded-lg bg-accent-green px-3 py-1.5 text-xs font-medium text-bg-primary disabled:opacity-50"
          >
            {submitting ? "Posting..." : "Post Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
