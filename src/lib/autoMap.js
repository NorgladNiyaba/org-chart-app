/**
 * Guesses which CSV column is which.
 *
 * HR exports name these columns a dozen different ways but rarely surprisingly,
 * so matching headers against a synonym list gets it right most of the time and
 * saves the four dropdowns. Every guess is still shown in the UI and can be
 * changed — this only picks the starting point.
 */

/** Columns belonging to someone *else* must not win the person's own fields. */
const FOREIGN = /\b(manager|supervisor|reports?\s*to|parent|boss|lead(er)?)\b/;

const FIELDS = {
  id: {
    synonyms: [
      "employee id",
      "employee number",
      "employee no",
      "emp id",
      "empno",
      "staff id",
      "person id",
      "worker id",
      "associate id",
      "user id",
      "payroll id",
      "badge",
      "id",
    ],
    foreignPenalty: true,
  },
  name: {
    synonyms: [
      "full name",
      "employee name",
      "display name",
      "person name",
      "staff name",
      "preferred name",
      "name",
    ],
    foreignPenalty: true,
  },
  title: {
    synonyms: [
      "job title",
      "position title",
      "title",
      "position",
      "role",
      "job",
      "designation",
      "job role",
    ],
    foreignPenalty: true,
  },
  managerId: {
    synonyms: [
      "manager id",
      "manager employee id",
      "supervisor id",
      "reports to id",
      "reports to",
      "reportsto",
      "parent id",
      "manager number",
      "manager",
      "supervisor",
      "reporting manager",
      "boss",
      "parent",
    ],
    foreignPenalty: false,
  },
};

/** Lowercase, punctuation to spaces, collapsed — "Employee_ID#" → "employee id". */
function normalise(header) {
  return String(header ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function scorePair(header, field) {
  const text = normalise(header);
  if (!text) return 0;

  const { synonyms, foreignPenalty } = FIELDS[field];
  let best = 0;

  synonyms.forEach((synonym, index) => {
    // Earlier synonyms are more specific, so they score higher.
    const specificity = 1 - index / (synonyms.length * 2);

    if (text === synonym) {
      best = Math.max(best, 100 * specificity);
      return;
    }

    const wordBoundary = new RegExp(`\\b${synonym.replace(/ /g, "\\s+")}\\b`);
    if (wordBoundary.test(text)) {
      best = Math.max(best, 78 * specificity);
    }
  });

  // "Manager Name" should never win `name`, however well it otherwise scores.
  if (best && foreignPenalty && FOREIGN.test(text)) best -= 60;

  return Math.max(0, best);
}

const MIN_SCORE = 30;

/**
 * @param {string[]} columns
 * @returns {{mapping: Object, scores: Object}} mapping uses "" for unmatched fields
 */
export function autoMapColumns(columns = []) {
  const pairs = [];

  Object.keys(FIELDS).forEach((field) => {
    columns.forEach((column) => {
      const score = scorePair(column, field);
      if (score >= MIN_SCORE) pairs.push({ field, column, score });
    });
  });

  // Greedy: the most confident pairing wins, then both sides are taken.
  pairs.sort((a, b) => b.score - a.score);

  const mapping = { id: "", name: "", title: "", managerId: "" };
  const scores = {};
  const usedColumns = new Set();

  pairs.forEach(({ field, column, score }) => {
    if (mapping[field] || usedColumns.has(column)) return;
    mapping[field] = column;
    scores[field] = Math.round(score);
    usedColumns.add(column);
  });

  return { mapping, scores };
}
