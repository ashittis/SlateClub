/*
  TS mirror of the CSS tokens in app/globals.css.

  Use these only when a colour has to live in JS/SVG/canvas. In markup, prefer
  the CSS variables or the Tailwind classes the `@theme inline` block generates.
  Keep this in step with globals.css — it is the same palette, twice.
*/
export const tokens = {
  canvas: {
    void: "#14121A",
    soot: "#2A2733",
    bleach: "#EDE7DB",
  },
  ink: {
    chalk: "#F5F2EC",
    xerox: "#A9A3B4",
    faint: "#8D8799",
  },
  accent: {
    blood: "#C41230",
    bloodHot: "#D41634",
    bloodInk: "#FF6B7D",
    acid: "#C8FF2E",
    cobalt: "#5C78FF",
    magenta: "#FF3D8B",
  },
  edge: {
    base: "#575167",
    hot: "#F5F2EC",
  },
  signal: {
    error: "#FF6B7D",
    ok: "#C8FF2E",
  },
} as const;
