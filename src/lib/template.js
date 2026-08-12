import { zipSync, strToU8 } from "fflate";

/**
 * The starter dataset, offered as a download and as the seed for building a
 * chart by hand.
 *
 * Headers are deliberately the ones autoMapColumns recognises, so a filled-in
 * template maps itself the moment it comes back in.
 */

export const TEMPLATE_COLUMNS = ["Employee ID", "Manager ID", "Name", "Job Title"];

export const TEMPLATE_ROWS = [
  ["1", "", "Alex Rivera", "Chief Executive Officer"],
  ["2", "1", "Priya Nair", "Clinical Director"],
  ["3", "1", "Sam Osei", "Operations Manager"],
  ["4", "1", "Dana Whitfield", "Finance Director"],
  ["5", "2", "Jordan Lee", "Nurse Practitioner"],
  ["6", "2", "Casey Morgan", "Licensed Therapist"],
  ["7", "2", "Robin Patel", "Care Coordinator"],
  ["8", "3", "Taylor Brooks", "IT Support Specialist"],
  ["9", "3", "Morgan Diaz", "HR Generalist"],
  ["10", "4", "Riley Chen", "Billing Specialist"],
  ["11", "4", "Avery Stone", "Claims Coordinator"],
];

/** Column widths in the spreadsheet, roughly matched to the header lengths. */
const COLUMN_WIDTHS = [14, 14, 24, 30];

/** The blank starting point: the same shape, one empty person. */
export function blankRows() {
  return [{ "Employee ID": "1", "Manager ID": "", Name: "", "Job Title": "" }];
}

export function templateRowObjects() {
  return TEMPLATE_ROWS.map((cells) =>
    Object.fromEntries(TEMPLATE_COLUMNS.map((column, index) => [column, cells[index]]))
  );
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function templateCsv() {
  return [TEMPLATE_COLUMNS, ...TEMPLATE_ROWS]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

const xmlEscape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 0 → A, 25 → Z, 26 → AA */
function columnLetter(index) {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * A minimal but valid xlsx package. Everything is written as an inline string,
 * which skips the shared-string table entirely — the file stays small and there
 * is one less part to keep consistent.
 */
function workbookParts() {
  const rows = [TEMPLATE_COLUMNS, ...TEMPLATE_ROWS];

  const sheetRows = rows
    .map((cells, rowIndex) => {
      const r = rowIndex + 1;
      const style = rowIndex === 0 ? ' s="1"' : "";
      const cellXml = cells
        .map(
          (value, columnIndex) =>
            `<c r="${columnLetter(columnIndex)}${r}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
        )
        .join("");
      return `<row r="${r}">${cellXml}</row>`;
    })
    .join("");

  const cols = COLUMN_WIDTHS.map(
    (width, index) =>
      `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  ).join("");

  return {
    "[Content_Types].xml": `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,

    "_rels/.rels": `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,

    "xl/workbook.xml": `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="People" sheetId="1" r:id="rId1"/></sheets></workbook>`,

    "xl/_rels/workbook.xml.rels": `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,

    "xl/styles.xml": `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,

    "xl/worksheets/sheet1.xml": `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
}

function download(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadTemplateCsv(fileName = "org-chart-template.csv") {
  // The BOM makes Excel read it as UTF-8 rather than the local codepage.
  const blob = new Blob(["\uFEFF", templateCsv()], {
    type: "text/csv;charset=utf-8",
  });
  download(blob, fileName);
}

// fflate is already in the bundle via jsPDF, so this costs nothing extra.
export function downloadTemplateXlsx(fileName = "org-chart-template.xlsx") {
  const parts = workbookParts();
  const files = Object.fromEntries(
    Object.entries(parts).map(([path, xml]) => [path, strToU8(xml)])
  );

  const zipped = zipSync(files, { level: 6 });
  download(
    new Blob([zipped], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    fileName
  );
}

/** Exposed so the package can be checked by a real spreadsheet reader in tests. */
export { workbookParts };
