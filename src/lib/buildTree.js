/**
 * Turns mapped CSV rows into an org hierarchy.
 *
 * Guiding rule: nobody disappears. Every row in the file ends up somewhere in the
 * chart, and anything the data doesn't say cleanly is reported as an issue rather
 * than silently dropped. Bad manager references, cycles and duplicate IDs place
 * the person at the top level instead of removing them.
 */

export const SEVERITY = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
};

export const ISSUE = {
  MISSING_ID: "missing-id",
  MISSING_NAME: "missing-name",
  DUPLICATE_ID: "duplicate-id",
  SELF_MANAGER: "self-manager",
  UNKNOWN_MANAGER: "unknown-manager",
  CYCLE: "cycle",
  MULTIPLE_ROOTS: "multiple-roots",
};

const UNNAMED = "(Unnamed)";

function cellValue(row, column) {
  if (!column) return "";
  const value = row[column];
  return value == null ? "" : String(value).trim();
}

/**
 * @param {Array<Object>} rows      mapped CSV rows, in file order
 * @param {Object} mapping          { id, name, title, managerId } column names
 * @returns {{ roots: Array, nodes: Map, issues: Array, stats: Object }}
 */
export function buildTree(rows, mapping = {}) {
  const {
    id: idColumn,
    name: nameColumn,
    title: titleColumn,
    managerId: managerColumn,
  } = mapping;

  const issues = [];
  const nodes = new Map();
  const ordered = [];

  if (!Array.isArray(rows) || !rows.length || !idColumn || !nameColumn) {
    return {
      roots: [],
      nodes,
      issues,
      stats: { total: 0, placed: 0, roots: 0, maxDepth: 0 },
    };
  }

  rows.forEach((row, index) => {
    // Row 1 is the header, so the first data row reads as row 2 in a spreadsheet.
    const rowNumber = index + 2;

    const rawId = cellValue(row, idColumn);
    const rawName = cellValue(row, nameColumn);
    const title = cellValue(row, titleColumn);
    const managerId = cellValue(row, managerColumn);

    const name = rawName || UNNAMED;
    if (!rawName) {
      issues.push({
        type: ISSUE.MISSING_NAME,
        severity: SEVERITY.WARNING,
        rowNumber,
        personId: rawId,
        personName: name,
        message: `Row ${rowNumber} has no name. It is shown as “${UNNAMED}” so the people reporting to it stay in place.`,
      });
    }

    // A row with no ID still describes a real person — keep them, but they cannot
    // be the target of anyone else's manager reference.
    let id = rawId;
    if (!id) {
      id = `__row-${rowNumber}`;
      issues.push({
        type: ISSUE.MISSING_ID,
        severity: SEVERITY.WARNING,
        rowNumber,
        personId: "",
        personName: name,
        message: `${name} (row ${rowNumber}) has no ID. They are shown in the chart, but nobody can report to them until you give them one.`,
      });
    } else if (nodes.has(id)) {
      const original = nodes.get(id);
      id = `${rawId} (row ${rowNumber})`;
      issues.push({
        type: ISSUE.DUPLICATE_ID,
        severity: SEVERITY.ERROR,
        rowNumber,
        personId: rawId,
        personName: name,
        message: `ID “${rawId}” is used by both ${original.name} and ${name} (row ${rowNumber}). Both are shown, but anyone reporting to “${rawId}” is placed under ${original.name}.`,
      });
    }

    const node = {
      id,
      sourceId: rawId,
      rowIndex: index,
      rowNumber,
      name,
      title,
      managerId: managerId || null,
      parentId: null,
      children: [],
    };

    nodes.set(id, node);
    ordered.push(node);
  });

  // Resolve manager references.
  ordered.forEach((node) => {
    if (!node.managerId) return;

    if (node.managerId === node.id || node.managerId === node.sourceId) {
      issues.push({
        type: ISSUE.SELF_MANAGER,
        severity: SEVERITY.ERROR,
        rowNumber: node.rowNumber,
        personId: node.sourceId,
        personName: node.name,
        message: `${node.name} is listed as their own manager. They are shown at the top level.`,
      });
      return;
    }

    if (!nodes.has(node.managerId)) {
      issues.push({
        type: ISSUE.UNKNOWN_MANAGER,
        severity: SEVERITY.WARNING,
        rowNumber: node.rowNumber,
        personId: node.sourceId,
        personName: node.name,
        message: `${node.name} reports to “${node.managerId}”, which isn't an ID in this file. They are shown at the top level.`,
      });
      return;
    }

    node.parentId = node.managerId;
  });

  breakCycles(ordered, nodes, issues);

  // Link children in file order so the chart is stable across rebuilds.
  ordered.forEach((node) => {
    if (node.parentId) nodes.get(node.parentId).children.push(node);
  });

  const roots = ordered.filter((node) => !node.parentId);

  // Without a manager column everyone is a root by definition — not worth reporting.
  if (managerColumn && roots.length > 1) {
    const named = roots.slice(0, 5).map((node) => node.name);
    const rest = roots.length - named.length;
    issues.push({
      type: ISSUE.MULTIPLE_ROOTS,
      severity: SEVERITY.INFO,
      rowNumber: null,
      personId: "",
      personName: "",
      message: `${roots.length} people sit at the top level: ${named.join(", ")}${
        rest > 0 ? ` and ${rest} more` : ""
      }. That is fine if your organisation genuinely has several, otherwise check their manager IDs.`,
    });
  }

  return {
    roots,
    nodes,
    issues,
    stats: {
      total: rows.length,
      placed: ordered.length,
      roots: roots.length,
      maxDepth: measureDepth(roots),
    },
  };
}

/**
 * Severs the link that closes each reporting loop, so the people caught in it are
 * shown at the top level rather than vanishing from an unreachable subtree.
 */
function breakCycles(ordered, nodes, issues) {
  const DONE = 2;
  const VISITING = 1;
  const state = new Map();

  ordered.forEach((start) => {
    if (state.get(start.id) === DONE) return;

    const path = [];
    let current = start;

    while (current && state.get(current.id) !== DONE) {
      if (state.get(current.id) === VISITING) {
        const loopStart = path.indexOf(current);
        const chain = path.slice(loopStart);
        current.parentId = null;
        issues.push({
          type: ISSUE.CYCLE,
          severity: SEVERITY.ERROR,
          rowNumber: current.rowNumber,
          personId: current.sourceId,
          personName: current.name,
          message: `Circular reporting line: ${chain
            .map((node) => node.name)
            .join(" → ")} → ${current.name}. ${current.name} was moved to the top level to break the loop.`,
        });
        break;
      }

      state.set(current.id, VISITING);
      path.push(current);
      current = current.parentId ? nodes.get(current.parentId) : null;
    }

    path.forEach((node) => state.set(node.id, DONE));
  });
}

function measureDepth(roots) {
  let deepest = 0;
  const stack = roots.map((node) => [node, 1]);

  while (stack.length) {
    const [node, depth] = stack.pop();
    if (depth > deepest) deepest = depth;
    node.children.forEach((child) => stack.push([child, depth + 1]));
  }

  return deepest;
}

/** Groups issues for display: errors first, then warnings, then info. */
export function summariseIssues(issues) {
  const order = [SEVERITY.ERROR, SEVERITY.WARNING, SEVERITY.INFO];
  const sorted = [...issues].sort(
    (a, b) =>
      order.indexOf(a.severity) - order.indexOf(b.severity) ||
      (a.rowNumber ?? 0) - (b.rowNumber ?? 0)
  );

  return {
    all: sorted,
    errors: sorted.filter((issue) => issue.severity === SEVERITY.ERROR),
    warnings: sorted.filter((issue) => issue.severity === SEVERITY.WARNING),
    info: sorted.filter((issue) => issue.severity === SEVERITY.INFO),
  };
}
