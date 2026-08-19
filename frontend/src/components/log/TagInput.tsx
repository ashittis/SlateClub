"use client";

import { useState } from "react";
import { CloseIcon, TagIcon } from "./logIcons";

const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 32;

/**
 * Tags on a viewing — "imax", "with-dad", "35mm".
 *
 * Normalised here as well as on the server. The server's pass is the one that
 * counts (the CSV importer comes through the same door), but doing it locally
 * means the chip you see is the chip that gets stored, rather than one that
 * quietly changes case on the next page load.
 *
 * Comma commits as well as Enter, because typing a list is the common motion
 * and reaching for Enter between each one is not.
 */
export default function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const full = tags.length >= MAX_TAGS;

  const commit = (raw: string) => {
    const tag = raw.trim().replace(/^#+/, "").trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (tag && !tags.includes(tag) && !full) onChange([...tags, tag]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div
        className="flex min-h-[48px] items-center gap-2.5 border px-3"
        style={{ borderColor: "var(--edge)", background: "var(--void)" }}
      >
        <TagIcon className="shrink-0" />
        <input
          type="text"
          value={draft}
          disabled={full}
          onChange={(e) => {
            // A typed comma is a commit, not a character.
            if (e.target.value.includes(",")) commit(e.target.value.replace(/,/g, ""));
            else setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Never let this submit the panel — Enter here means "add tag".
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => draft && commit(draft)}
          placeholder={full ? `${MAX_TAGS} tags is the limit` : "add a tag…"}
          aria-label="Add a tag"
          className="min-h-[44px] w-full bg-transparent text-sm outline-none disabled:opacity-60"
        />
      </div>

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                aria-label={`Remove tag ${tag}`}
                className="meta flex min-h-[44px] items-center gap-1.5 border px-3"
                style={{
                  borderColor: "var(--edge)",
                  background: "var(--soot)",
                  color: "var(--chalk)",
                }}
              >
                #{tag}
                <CloseIcon className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
