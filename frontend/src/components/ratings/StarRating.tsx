"use client";

import { useState, useCallback, type MouseEvent, type KeyboardEvent } from "react";

type StarSize = "sm" | "md" | "lg";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: StarSize;
}

const sizeMap: Record<StarSize, { star: number; gap: string }> = {
  sm: { star: 16, gap: "gap-0.5" },
  md: { star: 24, gap: "gap-1" },
  lg: { star: 32, gap: "gap-1.5" },
};

const TOTAL_STARS = 5;

function StarIcon({
  fill,
  size,
}: {
  fill: "full" | "half" | "empty";
  size: number;
}) {
  const id = `half-${Math.random().toString(36).slice(2, 9)}`;

  if (fill === "half") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="currentColor" className="text-accent-green" />
            <stop offset="50%" stopColor="currentColor" className="text-glass-12" />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
          fill={`url(#${id})`}
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={fill === "full" ? "text-accent-green" : "text-glass-12"}
      aria-hidden
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  );
}

function getStarFill(starIndex: number, rating: number): "full" | "half" | "empty" {
  const starNumber = starIndex + 1;
  if (rating >= starNumber) return "full";
  if (rating >= starNumber - 0.5) return "half";
  return "empty";
}

function ratingFromPointer(
  e: MouseEvent<HTMLDivElement>,
  starIndex: number,
  starWidth: number,
): number {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const isLeftHalf = x < starWidth / 2;
  return isLeftHalf ? starIndex + 0.5 : starIndex + 1;
}

export default function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const { star: starPx, gap } = sizeMap[size];

  const displayValue = hoverValue ?? value;
  const interactive = !readonly && !!onChange;

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>, starIndex: number) => {
      if (!interactive) return;
      const newValue = ratingFromPointer(e, starIndex, starPx);
      // Clicking the same value again clears the rating to 0
      onChange(newValue === value ? 0 : newValue);
    },
    [interactive, onChange, starPx, value],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>, starIndex: number) => {
      if (!interactive) return;
      setHoverValue(ratingFromPointer(e, starIndex, starPx));
    },
    [interactive, starPx],
  );

  const handleMouseLeave = useCallback(() => {
    if (interactive) setHoverValue(null);
  }, [interactive]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!interactive) return;
      let next = value;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        next = Math.min(TOTAL_STARS, value + 0.5);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        next = Math.max(0, value - 0.5);
      }
      if (next !== value) onChange(next);
    },
    [interactive, onChange, value],
  );

  return (
    <div
      role={interactive ? "slider" : "img"}
      aria-label={`Rating: ${value} out of ${TOTAL_STARS}`}
      aria-valuemin={0}
      aria-valuemax={TOTAL_STARS}
      aria-valuenow={value}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onMouseLeave={handleMouseLeave}
      className={`inline-flex ${gap} ${interactive ? "cursor-pointer" : ""} select-none`}
    >
      {Array.from({ length: TOTAL_STARS }, (_, i) => (
        <div
          key={i}
          onClick={(e) => handleClick(e, i)}
          onMouseMove={(e) => handleMouseMove(e, i)}
          className="relative"
          style={{ width: starPx, height: starPx }}
        >
          <StarIcon fill={getStarFill(i, displayValue)} size={starPx} />
        </div>
      ))}
    </div>
  );
}
