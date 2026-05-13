"use client";

/*
  Extract a single dominant colour from a TMDB poster.
  Implementation: load the image into a tiny offscreen
  canvas (32x48), average non-extreme pixels, return hex.
  Cached per src so the home hero doesn't re-paint on tab switch.
*/

const cache = new Map<string, string>();

export async function getDominantColor(src: string): Promise<string> {
  if (!src) return "#1A1A1F";
  if (cache.has(src)) return cache.get(src)!;

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";

    img.onerror = () => {
      cache.set(src, "#1A1A1F");
      resolve("#1A1A1F");
    };

    img.onload = () => {
      try {
        const w = 32;
        const h = 48;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          cache.set(src, "#1A1A1F");
          resolve("#1A1A1F");
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);

        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2], pa = data[i + 3];
          if (pa < 200) continue;
          // skip near-black and near-white pixels — they wash the gradient
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          if (max < 24 || min > 232) continue;
          r += pr;
          g += pg;
          b += pb;
          n += 1;
        }
        if (n === 0) {
          cache.set(src, "#1A1A1F");
          resolve("#1A1A1F");
          return;
        }
        const hex =
          "#" +
          [r / n, g / n, b / n]
            .map((c) => Math.round(c).toString(16).padStart(2, "0"))
            .join("");
        cache.set(src, hex);
        resolve(hex);
      } catch {
        cache.set(src, "#1A1A1F");
        resolve("#1A1A1F");
      }
    };

    img.src = src;
  });
}

/* mix two hex colours by t in [0..1] — used by AmbientBackdrop transitions */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return "#" + m.map((c) => c.toString(16).padStart(2, "0")).join("");
}

function parseHex(hex: string): number[] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0,
  ];
}
