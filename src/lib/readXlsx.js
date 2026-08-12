import { unzipSync, strFromU8 } from "fflate";
import { tableFromMatrix } from "./parseCsv.js";

/**
 * Reads .xlsx workbooks.
 *
 * An xlsx is a zip of XML parts, and fflate is already in the bundle for the
 * template writer, so this needs no new dependency. Only the parts that carry
 * cell values are read — shared strings, the sheets themselves, and enough of
 * the style table to tell a date apart from the number it is stored as.
 *
 * Every sheet is returned rather than just the first: workbooks routinely open
 * on a cover or instructions tab, and guessing wrong is worse than asking.
 */

const parseXml = (text) =>
  new DOMParser().parseFromString(text, "application/xml");

const textOf = (node) => (node ? node.textContent : "");

/** "BC12" → 54 (zero-based column index) */
function columnIndex(ref) {
  const letters = String(ref).match(/^[A-Z]+/)?.[0] ?? "A";
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

/** Built-in numeric formats that mean "date", plus anything with y/m/d in it. */
const DATE_BUILTINS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function isDateFormat(numFmtId, custom) {
  if (DATE_BUILTINS.has(numFmtId)) return true;
  const code = custom.get(numFmtId);
  if (!code) return false;
  // Strip quoted literals and colour/condition blocks before looking for tokens.
  const bare = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
  return /[ymdhs]/i.test(bare) && !/^[#0.,%\s]*$/.test(bare);
}

/** Excel's day-zero is 1899-12-30 once its 1900 leap-year quirk is accounted for. */
function serialToDate(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return String(serial);

  const iso = date.toISOString();
  const hasTime = Math.abs(serial - Math.floor(serial)) > 1e-6;
  return hasTime ? iso.slice(0, 16).replace("T", " ") : iso.slice(0, 10);
}

function readSharedStrings(files) {
  const part = files["xl/sharedStrings.xml"];
  if (!part) return [];

  const doc = parseXml(strFromU8(part));
  return Array.from(doc.getElementsByTagName("si")).map((si) => {
    // A styled string is split across runs; concatenating the <t> nodes rebuilds it.
    const texts = Array.from(si.getElementsByTagName("t")).map(textOf);
    return texts.join("");
  });
}

function readStyles(files) {
  const part = files["xl/styles.xml"];
  if (!part) return [];

  const doc = parseXml(strFromU8(part));

  const custom = new Map();
  Array.from(doc.getElementsByTagName("numFmt")).forEach((node) => {
    custom.set(Number(node.getAttribute("numFmtId")), node.getAttribute("formatCode"));
  });

  const cellXfs = doc.getElementsByTagName("cellXfs")[0];
  if (!cellXfs) return [];

  return Array.from(cellXfs.getElementsByTagName("xf")).map((xf) =>
    isDateFormat(Number(xf.getAttribute("numFmtId") ?? 0), custom)
  );
}

function cellValue(cell, sharedStrings, dateStyles) {
  const type = cell.getAttribute("t");

  if (type === "inlineStr") {
    const is = cell.getElementsByTagName("is")[0];
    if (!is) return "";
    return Array.from(is.getElementsByTagName("t")).map(textOf).join("");
  }

  const raw = textOf(cell.getElementsByTagName("v")[0]);
  if (raw === "" || raw == null) return "";

  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  if (type === "str") return raw;
  if (type === "b") return raw === "1" ? "TRUE" : "FALSE";
  if (type === "e") return raw;

  const styleIndex = Number(cell.getAttribute("s") ?? -1);
  if (styleIndex >= 0 && dateStyles[styleIndex]) {
    const serial = Number(raw);
    if (Number.isFinite(serial)) return serialToDate(serial);
  }

  // Numbers keep their stored text, so an ID of 1 never becomes "1.0".
  return raw;
}

function sheetMatrix(xml, sharedStrings, dateStyles) {
  const doc = parseXml(xml);
  const matrix = [];

  Array.from(doc.getElementsByTagName("row")).forEach((row) => {
    const cells = Array.from(row.getElementsByTagName("c"));
    if (!cells.length) return;

    const values = [];
    cells.forEach((cell) => {
      const ref = cell.getAttribute("r");
      const index = ref ? columnIndex(ref) : values.length;
      // Gaps in a sparse row have to be filled, or columns shift left.
      while (values.length < index) values.push("");
      values[index] = cellValue(cell, sharedStrings, dateStyles);
    });

    matrix.push(values);
  });

  return matrix;
}

/**
 * @param {File|ArrayBuffer} input
 * @returns {Promise<{sheets: Array<{name, columns, rows, warnings}>}>}
 */
export async function readWorkbook(input) {
  const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();

  let files;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error("That file isn't a readable Excel workbook.");
  }

  if (!files["xl/workbook.xml"]) {
    throw new Error(
      "That looks like a spreadsheet but not an .xlsx file. Older .xls files need to be saved as .xlsx or CSV first."
    );
  }

  const sharedStrings = readSharedStrings(files);
  const dateStyles = readStyles(files);

  // Sheet order and names live in the workbook; the file each maps to lives in
  // its relationships part.
  const rels = new Map();
  const relsPart = files["xl/_rels/workbook.xml.rels"];
  if (relsPart) {
    Array.from(parseXml(strFromU8(relsPart)).getElementsByTagName("Relationship")).forEach(
      (node) => rels.set(node.getAttribute("Id"), node.getAttribute("Target"))
    );
  }

  const workbook = parseXml(strFromU8(files["xl/workbook.xml"]));
  const sheetNodes = Array.from(workbook.getElementsByTagName("sheet"));

  const sheets = sheetNodes
    .map((node, index) => {
      const name = node.getAttribute("name") || `Sheet ${index + 1}`;
      const relId =
        node.getAttribute("r:id") ||
        node.getAttributeNS?.(
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
          "id"
        );

      let target = relId ? rels.get(relId) : null;
      if (target && target.startsWith("/")) target = target.slice(1);
      const path = target
        ? target.startsWith("xl/")
          ? target
          : `xl/${target}`
        : `xl/worksheets/sheet${index + 1}.xml`;

      const part = files[path];
      if (!part) return null;

      const matrix = sheetMatrix(strFromU8(part), sharedStrings, dateStyles);
      return { name, ...tableFromMatrix(matrix) };
    })
    .filter(Boolean);

  if (!sheets.length) throw new Error("That workbook has no readable sheets.");
  return { sheets };
}

/** The sheet most likely to hold the people: the one with the most rows. */
export function bestSheet(sheets) {
  return sheets.reduce(
    (best, sheet) => (sheet.rows.length > (best?.rows.length ?? -1) ? sheet : best),
    null
  );
}
