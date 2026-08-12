/**
 * Chart colours.
 *
 * Read from the --cat-* custom properties so tokens.css stays the single source
 * of truth and the ramp can be updated in one place. The literals below are the
 * same validated values, used only when computed styles aren't available.
 *
 * These are print colours: theme-independent by design, because the chart always
 * renders on white paper in both light and dark mode.
 */

const FALLBACK = {
  1: ["#0E9E7E", "#0B7F65"],
  2: ["#1A4BDB", "#1A4BDB"],
  3: ["#E0701F", "#B0561A"],
  4: ["#C4318F", "#C4318F"],
  5: ["#A07800", "#8A6600"],
  6: ["#6E56CF", "#6E56CF"],
  7: ["#C0392B", "#C0392B"],
  none: ["#5A6E8A", "#5A6E8A"],
};

export const PAPER = {
  bg: "#FFFFFF",
  ink: "#060D1A",
  ink2: "#5A6E8A",
  line: "rgba(6,13,26,0.28)",
  edge: "rgba(6,13,26,0.10)",
};

export const ROOT_COLOR = "#1A4BDB";

function readVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function readCategoryPalette() {
  const palette = {};
  Object.entries(FALLBACK).forEach(([key, [mark, ink]]) => {
    palette[key] = {
      mark: readVar(`--cat-${key}`, mark),
      ink: readVar(`--cat-${key}-ink`, ink),
    };
  });
  return palette;
}

/** #RRGGBB → rgba() at the given alpha. Non-hex input is returned untouched. */
export function withAlpha(color, alpha) {
  const hex = String(color).trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Resolves the full colour set a card is drawn with. */
export function colorsFor(card, palette) {
  if (card.variant === "root") {
    return {
      mark: ROOT_COLOR,
      ink: "#FFFFFF",
      surface: ROOT_COLOR,
      edge: ROOT_COLOR,
      tileFill: "rgba(255,255,255,0.18)",
      tileStroke: "rgba(255,255,255,0.32)",
      tileIcon: "#FFFFFF",
      primaryText: "#FFFFFF",
      secondaryText: "rgba(255,255,255,0.86)",
    };
  }

  const slot = palette[card.category ?? "none"] ?? palette.none;
  const isTeam = card.kind === "team";

  return {
    mark: slot.mark,
    ink: slot.ink,
    surface: isTeam ? withAlpha(slot.mark, 0.06) : PAPER.bg,
    edge: withAlpha(slot.mark, 0.35),
    tileFill: withAlpha(slot.mark, 0.12),
    tileStroke: withAlpha(slot.mark, 0.3),
    tileIcon: slot.mark,
    primaryText: PAPER.ink,
    secondaryText: slot.ink,
  };
}
