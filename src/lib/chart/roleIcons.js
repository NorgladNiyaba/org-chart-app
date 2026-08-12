/**
 * Role icons for chart cards.
 *
 * Defined as raw path data on a 24×24 grid in the Plexa "contained" style
 * (1.5 stroke, round caps) rather than as components, because the PDF writer
 * draws these same paths as vectors — an icon font or nested <svg> can't be
 * emitted that way.
 */

/** Circle expressed as two arcs, so every icon is path-only. */
const circle = (cx, cy, r) =>
  `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;

export const ICON_PATHS = {
  operations: [
    "M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    circle(12, 12, 3),
  ],
  clinical: [
    "M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2",
    "M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z",
    "M9 13h6",
    "M9 17h4",
  ],
  medical: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  team: [
    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2",
    circle(9, 7, 4),
    "M23 21v-2a4 4 0 00-3-3.87",
    "M16 3.13a4 4 0 010 7.75",
  ],
  person: ["M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2", circle(12, 7, 4)],
  it: [
    "M4 3h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z",
    "M8 21h8",
    "M12 17v4",
  ],
  billing: ["M12 1v22", "M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"],
  finance: ["M18 20V10", "M12 20V4", "M6 20v-6"],
  care: [
    "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  ],
  executive: [
    "M4 7h16a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z",
    "M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2",
    "M2 12h20",
  ],
  compliance: [
    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  ],
  legal: ["M12 3v18", "M5 7h14", "M7 7l-4 7h8z", "M17 7l-4 7h8z", "M8 21h8"],
  marketing: [
    "M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1z",
    "M16 8a5 5 0 010 8",
  ],
  facilities: [
    "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  ],
  logistics: [
    "M1 4h12a1 1 0 011 1v11H2a1 1 0 01-1-1V4z",
    "M15 8h3.5l2.5 3v5h-6z",
    circle(5.5, 18.5, 2.5),
    circle(18.5, 18.5, 2.5),
  ],
  training: [
    "M22 10L12 5 2 10l10 5 10-5z",
    "M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5",
  ],
  support: [
    "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8.1 9.5a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z",
  ],
};

/**
 * First match wins, so put the more specific terms first. Matched against the
 * person's title, falling back to their name.
 */
const RULES = [
  [/\b(coo|ceo|cfo|cto|president|chief|executive)\b/i, "operations"],
  [/\b(operations?|ops)\b/i, "operations"],
  [/\b(clinical|clinician|therap\w*|counsel(?:or|ling|ing)\w*|psych\w*|lcsw|licsw|lgsw|lpc)\b/i, "clinical"],
  [/\b(nurs\w*|rn|np|crnp|physician|doctor|dr|medical|health\w*)\b/i, "medical"],
  [/\b(care|intake|patient|outreach)\b/i, "care"],
  [/\b(bill\w*|revenue|claim\w*|authoriz\w*|invoic\w*|payroll|account\w*)\b/i, "billing"],
  [/\b(financ\w*|budget\w*|controller|treasur\w*)\b/i, "finance"],
  [/\b(it|ehr|emr|technolog\w*|system\w*|software|engineer\w*|developer|data|network\w*)\b/i, "it"],
  [/\b(hr|human resources|recruit\w*|people|talent|employee relations)\b/i, "team"],
  [/\b(train\w*|education\w*|learning|onboarding)\b/i, "training"],
  [/\b(legal|attorney|counsel|paralegal)\b/i, "legal"],
  [/\b(complian\w*|quality|audit\w*|risk|security|privacy)\b/i, "compliance"],
  [/\b(market\w*|sales|business development|communicat\w*|brand\w*)\b/i, "marketing"],
  [/\b(facilit\w*|maintenance|janitor\w*|building|propert\w*)\b/i, "facilities"],
  [/\b(logistic\w*|transport\w*|fleet|driver\w*|warehouse|shipping)\b/i, "logistics"],
  [/\b(support|help ?desk|service desk|call cent\w*)\b/i, "support"],
  [/\b(director|manager|supervisor|lead|principal|partner)\b/i, "executive"],
  [/\b(team|staff|group|department|unit)\b/i, "team"],
];

export function inferIcon({ title = "", name = "" } = {}) {
  const haystack = `${title} ${name}`;
  for (const [pattern, icon] of RULES) {
    if (pattern.test(haystack)) return icon;
  }
  return "person";
}

export const ICON_KEYS = Object.keys(ICON_PATHS);
