/**
 * Film grain — one layer for the whole app.
 *
 * Mounted once in the root layout, fixed to the viewport, `pointer-events:none`.
 * Deliberately NOT a per-component wrapper: a hundred grain layers is a hundred
 * composited surfaces, and scrolling pays for every one.
 *
 * `feTurbulence` is rendered once by the browser and tiled, so the cost is a
 * single paint regardless of page length.
 */
export default function Grain() {
  return (
    <svg className="grain-layer" aria-hidden focusable="false">
      <filter id="kaset-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.82"
          numOctaves={3}
          stitchTiles="stitch"
        />
        {/* Desaturate the noise so it reads as grain rather than colour speckle. */}
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#kaset-grain)" />
    </svg>
  );
}
