/**
 * Text measurement for the layout engine.
 *
 * The layout has to know how tall every card is before anything is drawn, so
 * wrapping happens here rather than being left to the renderer. The same wrapped
 * lines are handed to both the SVG preview and the PDF writer, which is what
 * keeps the two pixel-identical.
 */

let context = null;

function ctx() {
  if (!context) {
    const canvas = document.createElement("canvas");
    context = canvas.getContext("2d");
  }
  return context;
}

export const FONT_STACK = "Inter, system-ui, sans-serif";

export function measureText(text, { size = 12, weight = 400 } = {}) {
  if (!text) return 0;
  const c = ctx();
  c.font = `${weight} ${size}px ${FONT_STACK}`;
  return c.measureText(text).width;
}

/**
 * Greedy word wrap. Words longer than the line are broken mid-word so a single
 * unbroken string can never blow out the card width.
 */
export function wrapText(text, maxWidth, style = {}, maxLines = Infinity) {
  const clean = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return [];

  const lines = [];
  let current = "";

  const pushCurrent = () => {
    if (current) lines.push(current);
    current = "";
  };

  for (const word of clean.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;

    if (measureText(candidate, style) <= maxWidth) {
      current = candidate;
      continue;
    }

    pushCurrent();

    if (measureText(word, style) <= maxWidth) {
      current = word;
      continue;
    }

    // Break the oversized word across lines.
    let chunk = "";
    for (const char of word) {
      if (measureText(chunk + char, style) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    current = chunk;
  }

  pushCurrent();

  if (lines.length <= maxLines) return lines;

  const trimmed = lines.slice(0, maxLines);
  let last = trimmed[maxLines - 1];
  while (last && measureText(`${last}…`, style) > maxWidth) {
    last = last.slice(0, -1);
  }
  trimmed[maxLines - 1] = `${last.trimEnd()}…`;
  return trimmed;
}

/** Resolves once Inter is actually available, so measurements aren't taken against a fallback. */
export function whenFontsReady() {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return document.fonts.ready;
}
