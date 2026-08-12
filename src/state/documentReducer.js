/**
 * The chart document: everything that would be saved, and nothing that is merely
 * being looked at. Selection, search, zoom and collapse live in the component —
 * undoing a click on a card is not something anyone wants.
 *
 * History is kept here rather than bolted on, so every edit is undoable by
 * construction instead of each new feature having to remember to record itself.
 */

export const EMPTY_MAPPING = { id: "", name: "", title: "", managerId: "" };

export const emptyDocument = {
  rows: [],
  columns: [],
  mapping: EMPTY_MAPPING,
  /** Per-node presentation overrides, keyed by node id. */
  overrides: {},
  companyName: "",
  logoDataUrl: "",
  logoFileName: "",
  csvFileName: "",
  parseWarnings: [],
};

export const initialState = {
  past: [],
  present: emptyDocument,
  future: [],
};

const HISTORY_LIMIT = 50;

/** Actions that replace the whole document start a fresh history. */
const RESETTING = new Set(["load-data", "reset"]);

/** Actions that change presentation but aren't worth an undo step of their own. */
const TRANSIENT = new Set(["set-branding", "set-logo"]);

function documentReducer(doc, action) {
  switch (action.type) {
    case "load-data":
      return {
        ...doc,
        rows: action.rows,
        columns: action.columns,
        mapping: action.mapping ?? EMPTY_MAPPING,
        overrides: {},
        csvFileName: action.fileName ?? "",
        parseWarnings: action.warnings ?? [],
      };

    case "set-mapping":
      return { ...doc, mapping: { ...doc.mapping, [action.field]: action.value } };

    case "edit-cell": {
      const column = doc.mapping[action.field];
      if (!column) return doc;

      const rows = [...doc.rows];
      const current = rows[action.rowIndex];
      if (!current || current[column] === action.value) return doc;

      rows[action.rowIndex] = { ...current, [column]: action.value };
      return { ...doc, rows };
    }

    case "reparent": {
      const column = doc.mapping.managerId;
      if (!column) return doc;

      const rows = [...doc.rows];
      let changed = false;

      action.rowIndexes.forEach((rowIndex) => {
        const current = rows[rowIndex];
        if (!current || current[column] === action.managerId) return;
        rows[rowIndex] = { ...current, [column]: action.managerId };
        changed = true;
      });

      return changed ? { ...doc, rows } : doc;
    }

    case "set-override": {
      const existing = doc.overrides[action.id] ?? {};
      const next = { ...existing, ...action.patch };

      // Only `undefined` clears a key. `null` is a real choice — it is how the
      // neutral colour is stored — so it has to survive.
      Object.keys(action.patch).forEach((key) => {
        if (next[key] === undefined) delete next[key];
      });

      const overrides = { ...doc.overrides };
      if (Object.keys(next).length) overrides[action.id] = next;
      else delete overrides[action.id];

      return { ...doc, overrides };
    }

    case "clear-override": {
      if (!doc.overrides[action.id]) return doc;
      const overrides = { ...doc.overrides };
      delete overrides[action.id];
      return { ...doc, overrides };
    }

    case "clear-overrides":
      return { ...doc, overrides: {} };

    case "set-branding":
      return { ...doc, companyName: action.companyName };

    case "set-logo":
      return {
        ...doc,
        logoDataUrl: action.logoDataUrl,
        logoFileName: action.logoFileName,
      };

    case "reset":
      return emptyDocument;

    default:
      return doc;
  }
}

export function historyReducer(state, action) {
  if (action.type === "undo") {
    if (!state.past.length) return state;
    const previous = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
    };
  }

  if (action.type === "redo") {
    if (!state.future.length) return state;
    const [next, ...rest] = state.future;
    return {
      past: [...state.past, state.present],
      present: next,
      future: rest,
    };
  }

  const present = documentReducer(state.present, action);
  if (present === state.present) return state;

  if (RESETTING.has(action.type)) {
    return { past: [], present, future: [] };
  }

  if (TRANSIENT.has(action.type)) {
    return { ...state, present };
  }

  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present,
    future: [],
  };
}
