import { inferIcon } from "./roleIcons.js";

/**
 * Turns the reporting hierarchy into a tree of *cards* to draw.
 *
 * Three things happen here that the raw hierarchy doesn't express:
 *
 *  1. Each top-level branch is assigned a categorical colour, inherited by its
 *     descendants. Colour follows the branch, never the position, so adding a
 *     department can't repaint the others.
 *  2. A group of leaves reporting to the same person collapses into a single
 *     team card. That is the trick that keeps a 60-person chart on one page —
 *     and it's what the reference layout does.
 *  3. Per-node overrides are applied last, so anything inferred can be corrected
 *     without the correction being recomputed away.
 *
 * Collapsed subtrees are pruned here rather than hidden at render time, because
 * the layout has to reclaim the space they occupied.
 */

/** Slots past the last one fold into a neutral, rather than generating a hue. */
export const CATEGORY_COUNT = 7;

/**
 * Only ever stripped from the end. Removing a role noun from the middle turns
 * "COO / Director of Operations" into "COO / of Operations".
 */
const TRAILING_ROLE_NOUN =
  /\s*\b(director|manager|supervisor|lead|head|officer|chief|president|vp|coordinator|specialist|administrator)\s*$/i;

/**
 * "Clinical Director (CRNP-PMH)" → "Clinical Team"
 * "IT, EHR & Human Resources Manager" → "IT, EHR & Human Resources Team"
 *
 * Separators are kept — only parentheticals and the trailing role noun come off,
 * and any separator left dangling at either end is tidied up.
 */
export function teamLabel(parent) {
  const source = parent.title || parent.name || "";
  const stripped = source
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_ROLE_NOUN, "")
    .replace(/^[\s\-–—/,&]+|[\s\-–—/,&]+$/g, "")
    .trim();

  const base = stripped || parent.name || "";
  return base ? `${base} Team` : "Team";
}

function isLeaf(node) {
  return !node.children || node.children.length === 0;
}

function countDescendants(node) {
  let total = 0;
  const stack = [...(node.children || [])];
  while (stack.length) {
    const current = stack.pop();
    total += 1;
    stack.push(...(current.children || []));
  }
  return total;
}

export function buildChartModel(roots, options = {}) {
  const {
    groupTeams = true,
    teamThreshold = 2,
    roleFirst = true,
    overrides = {},
    collapsed = {},
  } = options;

  // With one root the branches are its children; with several, each root is a branch.
  const branchDepth = roots.length === 1 ? 1 : 0;
  let branchCount = 0;

  // Past the last slot, branches fold to the neutral rather than getting a
  // generated hue — an eighth colour would not survive the separation checks.
  const nextCategory = () => {
    branchCount += 1;
    return branchCount <= CATEGORY_COUNT ? branchCount : null;
  };

  const toCard = (node, depth, inheritedCat) => {
    const override = overrides[node.id] ?? {};
    const category = depth === branchDepth ? nextCategory() : inheritedCat;
    const isRoot = depth === 0 && branchDepth === 1;

    const role = node.title || "";
    const defaultPrimary = roleFirst ? role || node.name : node.name;
    const defaultSecondary = roleFirst ? (role ? node.name : "") : role;

    const card = {
      kind: "person",
      variant: isRoot ? "root" : "branch",
      id: node.id,
      sourceId: node.sourceId,
      rowIndex: node.rowIndex,
      rowIndexes: [node.rowIndex],
      category: override.category !== undefined ? override.category : isRoot ? null : category,
      icon: override.icon ?? inferIcon(node),
      primary: override.primary ?? defaultPrimary,
      secondary: override.secondary ?? defaultSecondary,
      depth,
      isOverridden: Object.keys(override).length > 0,
      hiddenCount: 0,
      children: [],
    };

    const children = node.children || [];
    if (!children.length) return card;

    if (collapsed[node.id]) {
      card.hiddenCount = countDescendants(node);
      return card;
    }

    // A per-node setting wins over the global toggle in both directions.
    const wantsGrouping = override.grouped ?? groupTeams;
    const allLeaves = children.every(isLeaf);

    if (wantsGrouping && allLeaves && children.length >= teamThreshold) {
      const teamId = `${node.id}::team`;
      const teamOverride = overrides[teamId] ?? {};

      card.children = [
        {
          kind: "team",
          variant: "team",
          id: teamId,
          parentId: node.id,
          rowIndexes: children.map((child) => child.rowIndex),
          category:
            teamOverride.category !== undefined
              ? teamOverride.category
              : isRoot
                ? null
                : category,
          icon: teamOverride.icon ?? "team",
          label: teamOverride.primary ?? teamLabel(node),
          isOverridden: Object.keys(teamOverride).length > 0,
          members: children.map((child) => ({
            id: child.id,
            rowIndex: child.rowIndex,
            name: child.name,
            title: child.title || "",
          })),
          depth: depth + 1,
          hiddenCount: 0,
          children: [],
        },
      ];
      return card;
    }

    card.children = children.map((child) =>
      toCard(child, depth + 1, isRoot ? undefined : category)
    );
    return card;
  };

  return roots.map((root) => toCard(root, 0, undefined));
}

/** Counts what will actually be drawn — cards, not people. */
export function countCards(cards) {
  let people = 0;
  let teams = 0;
  const stack = [...cards];

  while (stack.length) {
    const card = stack.pop();
    if (card.kind === "team") teams += 1;
    else people += 1;
    stack.push(...card.children);
  }

  return { people, teams, total: people + teams };
}

/** Text a card should be matched against when searching. */
export function searchTextFor(card) {
  if (card.kind === "team") {
    return [card.label, ...card.members.flatMap((m) => [m.name, m.title])]
      .join(" ")
      .toLowerCase();
  }
  return `${card.primary} ${card.secondary}`.toLowerCase();
}
