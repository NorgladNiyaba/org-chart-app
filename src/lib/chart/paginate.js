import { computeLayout, CARD } from "./layout.js";

/**
 * Decides how the chart is split across pages.
 *
 * A whole organisation rarely fits on one sheet at a readable size, so rather
 * than shrinking until the type is unreadable we split the way these are
 * actually presented — but only as far as necessary:
 *
 *  1. If it fits, one page. Done.
 *  2. Otherwise the top card is repeated on each page with as many of its
 *     branches as will fit, so context is never lost and near-empty pages
 *     don't pile up.
 *  3. A single branch too big for a page of its own gets an overview, then the
 *     same treatment applied to each of its branches.
 *
 * The threshold is points of real type, not a scale factor, so the rule reads
 * "never smaller than this on paper".
 */

/** Chart units are points, so this is literally the printed size of a card's main line. */
export const MIN_PRIMARY_PT = 7;

/** Stops a pathological tree from splitting forever. */
const MAX_SPLIT_DEPTH = 4;

const minScale = MIN_PRIMARY_PT / CARD.branch.primary.size;

export function fitScale(layout, box) {
  if (!layout.width || !layout.height) return 1;
  return Math.min(box.width / layout.width, box.height / layout.height, 1);
}

const fits = (layout, box) => fitScale(layout, box) >= minScale;

/** Deep copy of a card subtree with everything below maxDepth removed. */
function truncate(card, maxDepth, depth = 0) {
  const copy = { ...card };
  copy.children =
    depth >= maxDepth
      ? []
      : card.children.map((child) => truncate(child, maxDepth, depth + 1));
  return copy;
}

const hasDescendants = (card) => card.children.length > 0;

/** A branch card becomes the root of its own page, keeping its assigned colour. */
const asPageRoot = (card) => ({ ...card, depth: 0 });

function labelFor(card) {
  if (card.kind === "team") return card.label;
  return card.primary || card.secondary || "Branch";
}

/** Greedily packs children into the fewest groups that each fit on a page. */
function groupChildren(root, box) {
  const groups = [];
  let current = [];

  root.children.forEach((child) => {
    const candidate = [...current, child];
    const layout = computeLayout([{ ...root, children: candidate }]);

    if (candidate.length === 1 || fits(layout, box)) {
      current = candidate;
      return;
    }

    groups.push(current);
    current = [child];
  });

  if (current.length) groups.push(current);
  return groups;
}

function pagesForRoot(root, box, title, depth) {
  const whole = computeLayout([root]);

  if (fits(whole, box) || !root.children.length || depth >= MAX_SPLIT_DEPTH) {
    return [{ title, layout: whole, kind: title ? "branch" : "full" }];
  }

  const groups = groupChildren(root, box);
  const pages = [];

  groups.forEach((group, index) => {
    const pageRoot = { ...root, children: group };
    const layout = computeLayout([pageRoot]);
    const suffix = groups.length > 1 ? ` (${index + 1} of ${groups.length})` : "";
    const base = title ? `${title}${suffix}` : suffix.trim() || null;

    if (fits(layout, box)) {
      pages.push({ title: base, layout, kind: "branch" });
      return;
    }

    // One branch is too big even on its own page: show it in outline, then
    // give each of its own branches the same treatment.
    pages.push({
      title: base ? `${base} — overview` : "Overview",
      layout: computeLayout([truncate(pageRoot, 1)]),
      kind: "overview",
    });

    group.filter(hasDescendants).forEach((child) => {
      pages.push(...pagesForRoot(asPageRoot(child), box, labelFor(child), depth + 1));
    });
  });

  return pages;
}

/**
 * @param {Array} model  card tree from buildChartModel
 * @param {{width:number,height:number}} box  printable area in points
 * @returns {Array<{title:string|null, layout:object, kind:string}>}
 */
export function planPages(model, box) {
  if (!model?.length) return [];

  const whole = computeLayout(model);
  if (fits(whole, box)) return [{ title: null, layout: whole, kind: "full" }];

  // Several top-level people are laid out side by side; give each its own pages.
  if (model.length > 1) {
    return model.flatMap((root) => pagesForRoot(root, box, labelFor(root), 0));
  }

  return pagesForRoot(model[0], box, null, 0);
}
