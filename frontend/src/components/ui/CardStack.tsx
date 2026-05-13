"use client";

import Image from "next/image";
import { motion } from "framer-motion";

/*
  CardStack — fanned poster collage used by Home hero,
  Onboarding Step 8 (Ready), and Slate covers.

  Variants:
   - fan:     3 layered posters, focused one in front,
              the others rotated and translated behind.
   - mosaic:  2x2 grid of 4 posters (Slate covers).
   - spiral:  centre poster, others orbiting (Slate detail).
*/

export type CardStackVariant = "fan" | "mosaic" | "spiral";

interface CardStackProps {
  posters: string[];
  variant?: CardStackVariant;
  size?: "sm" | "md" | "lg";
  alt?: string;
}

const sizeMap = {
  sm: { w: 140, h: 210 },
  md: { w: 220, h: 330 },
  lg: { w: 280, h: 420 },
};

export default function CardStack({
  posters,
  variant = "fan",
  size = "md",
  alt = "",
}: CardStackProps) {
  const dims = sizeMap[size];
  const list = posters.slice(0, variant === "mosaic" ? 4 : 3);

  if (variant === "mosaic") {
    const placeholders = ["", "", "", ""].map((_, i) => list[i] || list[0] || "");
    return (
      <div
        className="grid grid-cols-2 gap-1 overflow-hidden rounded-xl"
        style={{ width: dims.w, height: dims.h }}
      >
        {placeholders.map((src, i) => (
          <div key={i} className="relative bg-[var(--bg-elevated)]">
            {src ? (
              <Image
                src={src}
                alt={alt}
                fill
                sizes={`${dims.w / 2}px`}
                className="object-cover"
              />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (variant === "spiral") {
    const offsets = [
      { x: -28, y: -16, r: -6, scale: 0.86, z: 1 },
      { x: 28, y: -10, r: 6, scale: 0.86, z: 1 },
      { x: 0, y: 0, r: 0, scale: 1, z: 2 },
    ];
    return (
      <div
        className="relative"
        style={{ width: dims.w + 80, height: dims.h + 24 }}
      >
        {list.map((src, i) => {
          const o = offsets[i] || offsets[2];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: o.y }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              style={{
                position: "absolute",
                left: "50%",
                top: 12,
                width: dims.w,
                height: dims.h,
                marginLeft: -dims.w / 2,
                transform: `translateX(${o.x}px) rotate(${o.r}deg) scale(${o.scale})`,
                zIndex: o.z,
              }}
              className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/40"
            >
              {src ? (
                <Image
                  src={src}
                  alt={alt}
                  fill
                  sizes={`${dims.w}px`}
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[var(--bg-elevated)]" />
              )}
            </motion.div>
          );
        })}
      </div>
    );
  }

  // fan variant — focused front, two layered behind
  const fanOffsets = [
    { x: -54, y: 18, r: -10, scale: 0.88, z: 1, opacity: 0.55 },
    { x: 54, y: 18, r: 10, scale: 0.88, z: 1, opacity: 0.55 },
    { x: 0, y: 0, r: 0, scale: 1, z: 2, opacity: 1 },
  ];

  return (
    <div
      className="relative"
      style={{ width: dims.w + 110, height: dims.h + 30 }}
    >
      {list.map((src, i) => {
        const o = fanOffsets[i] || fanOffsets[2];
        return (
          <motion.div
            key={`${src}-${i}`}
            initial={{ opacity: 0, y: 24, scale: o.scale * 0.96 }}
            animate={{ opacity: o.opacity, y: o.y, scale: o.scale }}
            transition={{
              duration: 0.7,
              delay: i * 0.08,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            style={{
              position: "absolute",
              left: "50%",
              top: 12,
              width: dims.w,
              height: dims.h,
              marginLeft: -dims.w / 2,
              transform: `translateX(${o.x}px) rotate(${o.r}deg)`,
              zIndex: o.z,
            }}
            className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/40"
          >
            {src ? (
              <Image
                src={src}
                alt={alt}
                fill
                sizes={`${dims.w}px`}
                className="object-cover"
                priority={i === 2}
              />
            ) : (
              <div className="h-full w-full bg-[var(--bg-elevated)]" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
