import Papa from "papaparse";

/**
 * CSV parsing for the org chart builder.
 *
 * Reads the file as text first so that a bad delimiter guess can be corrected by
 * re-parsing rather than by splitting strings by hand — which would break on any
 * quoted field containing the delimiter.
 */

const DELIMITERS = [",", ";", "\t", "|"];

function cleanHeader(header, index) {
  const cleaned = String(header ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
  return cleaned || `Column ${index + 1}`;
}

/** Blank and duplicated headers are common in HR exports; make every key usable. */
function uniqueHeaders(headerRow) {
  const seen = new Map();
  return headerRow.map((header, index) => {
    const base = cleanHeader(header, index);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function isBlankRow(cells) {
  return cells.every((cell) => String(cell ?? "").trim() === "");
}

export function parseCsvText(text) {
  let result = Papa.parse(text, { header: false, skipEmptyLines: "greedy" });

  // One column whose header still contains a delimiter means the guess was wrong.
  const headerRow = result.data[0];
  if (headerRow && headerRow.length === 1) {
    const fallback = DELIMITERS.find(
      (d) => d !== result.meta.delimiter && String(headerRow[0]).includes(d)
    );
    if (fallback) {
      result = Papa.parse(text, {
        header: false,
        skipEmptyLines: "greedy",
        delimiter: fallback,
      });
    }
  }

  const [rawHeader, ...bodyRows] = result.data;
  if (!rawHeader || !rawHeader.length) {
    return { columns: [], rows: [], delimiter: result.meta.delimiter, warnings: [] };
  }

  const columns = uniqueHeaders(rawHeader);
  const dataRows = bodyRows.filter(
    (cells) => Array.isArray(cells) && !isBlankRow(cells)
  );

  const rows = dataRows.map((cells) => {
    const row = {};
    columns.forEach((column, index) => {
      row[column] = cells[index] != null ? String(cells[index]).trim() : "";
    });
    return row;
  });

  const warnings = [];
  const raggedRows = dataRows.filter((cells) => cells.length !== columns.length).length;
  if (raggedRows > 0) {
    warnings.push(
      `${raggedRows} ${raggedRows === 1 ? "row has" : "rows have"} a different number of columns than the header. Missing values were left blank.`
    );
  }

  return { columns, rows, delimiter: result.meta.delimiter, warnings };
}

export async function parseCsvFile(file) {
  const text = await file.text();
  return parseCsvText(text);
}
