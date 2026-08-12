import { flextree } from "d3-flextree";
import { measureText, wrapText } from "./text.js";

/**
 * Geometry for the chart. Every position, size and wrapped line is computed here
 * and handed to the renderers — the SVG preview and the PDF writer both consume
 * this output, which is what keeps them identical.
 *
 * Units are px at scale 1; the renderers scale the whole thing.
 */

export const CARD = {
  root: {
    width: 320,
    pad: 18,
    iconSize: 44,
    iconGap: 16,
    radius: 12,
    primary: { size: 15, weight: 600, lh: 20, maxLines: 3 },
    secondary: { size: 13, weight: 500, lh: 18, maxLines: 2 },
  },
  branch: {
    width: 204,
    pad: 14,
    iconSize: 34,
    iconGap: 10,
    radius: 10,
    primary: { size: 13, weight: 600, lh: 17, maxLines: 3 },
    secondary: { size: 12, weight: 500, lh: 16, maxLines: 2 },
  },
  team: {
    width: 214,
    pad: 14,
    radius: 10,
    heading: { size: 12, weight: 700, lh: 16, maxLines: 2 },
    member: { size: 11.5, weight: 500, lh: 15, maxLines: 2 },
    memberTitle: { size: 10.5, weight: 400, lh: 13, maxLines: 1 },
    bulletInset: 12,
    memberGap: 7,
    headingGap: 10,
  },
};

/** Printed marker on a collapsed card, so an export never silently omits people. */
export const HIDDEN_BADGE = { size: 10, weight: 500, lh: 14, gap: 5 };

export const LEVEL_GAP = 54;
export const SIBLING_GAP = 22;
export const BRANCH_GAP = 38;
export const ROOT_GAP = 64;
export const MARGIN = 28;
const STUB = 22;

function sizeRootCard(card) {
  const spec = CARD.root;
  const textWidth = spec.width - spec.pad * 2 - spec.iconSize - spec.iconGap;

  const primary = wrapText(card.primary, textWidth, spec.primary, spec.primary.maxLines);
  const secondary = wrapText(
    card.secondary,
    textWidth,
    spec.secondary,
    spec.secondary.maxLines
  );

  const textHeight =
    primary.length * spec.primary.lh +
    (secondary.length ? 4 + secondary.length * spec.secondary.lh : 0) +
    (card.hiddenCount ? HIDDEN_BADGE.gap + HIDDEN_BADGE.lh : 0);

  return {
    width: spec.width,
    height: Math.max(spec.iconSize, textHeight) + spec.pad * 2,
    lines: { primary, secondary },
    textWidth,
  };
}

function sizeBranchCard(card) {
  const spec = CARD.branch;
  const textWidth = spec.width - spec.pad * 2;

  const primary = wrapText(card.primary, textWidth, spec.primary, spec.primary.maxLines);
  const secondary = wrapText(
    card.secondary,
    textWidth,
    spec.secondary,
    spec.secondary.maxLines
  );

  const height =
    spec.pad +
    spec.iconSize +
    spec.iconGap +
    primary.length * spec.primary.lh +
    (secondary.length ? 3 + secondary.length * spec.secondary.lh : 0) +
    (card.hiddenCount ? HIDDEN_BADGE.gap + HIDDEN_BADGE.lh : 0) +
    spec.pad;

  return { width: spec.width, height, lines: { primary, secondary }, textWidth };
}

function sizeTeamCard(card) {
  const spec = CARD.team;
  const textWidth = spec.width - spec.pad * 2;
  const memberWidth = textWidth - spec.bulletInset;

  const heading = wrapText(card.label, textWidth, spec.heading, spec.heading.maxLines);

  let membersHeight = 0;
  const members = card.members.map((member) => {
    const nameLines = wrapText(member.name, memberWidth, spec.member, spec.member.maxLines);
    const titleLines = member.title
      ? wrapText(member.title, memberWidth, spec.memberTitle, spec.memberTitle.maxLines)
      : [];

    const height =
      nameLines.length * spec.member.lh + titleLines.length * spec.memberTitle.lh;
    membersHeight += height + spec.memberGap;

    return { ...member, nameLines, titleLines, height };
  });

  if (members.length) membersHeight -= spec.memberGap;

  const height =
    spec.pad + heading.length * spec.heading.lh + spec.headingGap + membersHeight + spec.pad;

  return { width: spec.width, height, lines: { heading }, members, textWidth };
}

function sizeCard(card) {
  if (card.kind === "team") return sizeTeamCard(card);
  if (card.variant === "root") return sizeRootCard(card);
  return sizeBranchCard(card);
}

/** Elbow connectors: a stub down from the parent, a bus across, a drop into each child. */
function connectorsFor(parent, children) {
  if (!children.length) return [];

  const startY = parent.y + parent.height;
  const busY = startY + STUB;
  const parentX = parent.x + parent.width / 2;

  if (children.length === 1) {
    const child = children[0];
    const childX = child.x + child.width / 2;
    if (Math.abs(childX - parentX) < 0.5) {
      return [`M${parentX},${startY}V${child.y}`];
    }
    return [`M${parentX},${startY}V${busY}H${childX}V${child.y}`];
  }

  const centres = children.map((child) => child.x + child.width / 2);
  const left = Math.min(...centres, parentX);
  const right = Math.max(...centres, parentX);

  const paths = [`M${parentX},${startY}V${busY}`, `M${left},${busY}H${right}`];
  children.forEach((child, index) => {
    paths.push(`M${centres[index]},${busY}V${child.y}`);
  });

  return paths;
}

function layoutOneTree(card) {
  const layout = flextree({
    nodeSize: (node) => [node.data._size.width, node.data._size.height + LEVEL_GAP],
    spacing: (a, b) => (a.parent === b.parent ? SIBLING_GAP : BRANCH_GAP),
  });

  // Attach measurements before the layout runs; it needs them to size nodes.
  const attach = (node) => {
    node._size = sizeCard(node);
    node.children.forEach(attach);
    return node;
  };
  attach(card);

  const tree = layout.hierarchy(card);
  layout(tree);

  const cards = [];
  const connectors = [];

  tree.each((node) => {
    const size = node.data._size;
    const placed = {
      ...node.data,
      x: node.x - size.width / 2,
      y: node.y,
      width: size.width,
      height: size.height,
      lines: size.lines,
      members: size.members,
      textWidth: size.textWidth,
      hasChildren: Boolean(node.children?.length),
    };
    node._placed = placed;
    cards.push(placed);
  });

  tree.each((node) => {
    if (!node.children?.length) return;
    connectors.push(
      ...connectorsFor(
        node._placed,
        node.children.map((child) => child._placed)
      )
    );
  });

  return { cards, connectors };
}

function boundsOf(cards) {
  const left = Math.min(...cards.map((c) => c.x));
  const right = Math.max(...cards.map((c) => c.x + c.width));
  const top = Math.min(...cards.map((c) => c.y));
  const bottom = Math.max(...cards.map((c) => c.y + c.height));
  return { left, right, top, bottom };
}

function shift(cards, connectors, dx, dy) {
  const moved = cards.map((card) => ({ ...card, x: card.x + dx, y: card.y + dy }));
  const movedPaths = connectors.map((path) =>
    path.replace(/([MHV])(-?[\d.]+)(?:,(-?[\d.]+))?/g, (_, cmd, a, b) => {
      if (cmd === "H") return `H${Number(a) + dx}`;
      if (cmd === "V") return `V${Number(a) + dy}`;
      return `M${Number(a) + dx},${Number(b) + dy}`;
    })
  );
  return { cards: moved, connectors: movedPaths };
}

/**
 * @param {Array} rootCards  output of buildChartModel
 * @returns {{cards, connectors, width, height}} geometry with (0,0) at the top-left
 */
export function computeLayout(rootCards) {
  if (!rootCards.length) return { cards: [], connectors: [], width: 0, height: 0 };

  const trees = rootCards.map(layoutOneTree);

  // Separate roots are laid out independently and then placed side by side.
  let cursor = 0;
  const placed = trees.map((tree) => {
    const bounds = boundsOf(tree.cards);
    const result = shift(tree.cards, tree.connectors, cursor - bounds.left, -bounds.top);
    cursor += bounds.right - bounds.left + ROOT_GAP;
    return result;
  });

  const cards = placed.flatMap((tree) => tree.cards);
  const connectors = placed.flatMap((tree) => tree.connectors);
  const bounds = boundsOf(cards);

  const shifted = shift(cards, connectors, MARGIN - bounds.left, MARGIN - bounds.top);

  return {
    cards: shifted.cards,
    connectors: shifted.connectors,
    width: bounds.right - bounds.left + MARGIN * 2,
    height: bounds.bottom - bounds.top + MARGIN * 2,
  };
}

export { measureText };
