import jsPDF from "jspdf";
import { createElement } from "react";
import ChartSvg from "../../components/ChartSvg.jsx";
import { planPages, fitScale } from "./paginate.js";
import { PAPER } from "./palette.js";

import interRegularUrl from "../../assets/fonts/Inter_400Regular.ttf?url";
import interMediumUrl from "../../assets/fonts/Inter_500Medium.ttf?url";
import interSemiBoldUrl from "../../assets/fonts/Inter_600SemiBold.ttf?url";
import interBoldUrl from "../../assets/fonts/Inter_700Bold.ttf?url";

/**
 * Vector PDF export.
 *
 * The chart is drawn as real vectors with embedded Inter, so text stays
 * selectable, searchable and sharp at any zoom. Both the preview and this file
 * consume the same geometry from computeLayout, which is what keeps the exported
 * page identical to what was on screen.
 */

const PAGE = { format: "letter", orientation: "landscape" };
const MARGIN = 36;
const HEADER_H = 52;
const FOOTER_H = 24;

let fontCache = null;

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  // Chunked so a large font can't blow the argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function loadFonts() {
  if (fontCache) return fontCache;

  const [regular, medium, semibold, bold] = await Promise.all(
    [interRegularUrl, interMediumUrl, interSemiBoldUrl, interBoldUrl].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not load font: ${url}`);
      return toBase64(await response.arrayBuffer());
    })
  );

  fontCache = { regular, medium, semibold, bold };
  return fontCache;
}

/**
 * Every weight the chart uses has to be registered, because svg2pdf resolves a
 * weight to a jsPDF *style name* — 400 becomes "normal", 700 becomes "bold", and
 * anything else becomes e.g. "500normal". A weight with no matching style
 * silently falls back to Times, so this set must track the CARD spec.
 *
 * All four are registered with style "normal": jsPDF derives the style name from
 * the weight, so passing "bold" alongside 700 yields the unusable "boldbold".
 */
const FONT_WEIGHTS = [
  { file: "Inter-Regular.ttf", key: "regular", weight: 400 },
  { file: "Inter-Medium.ttf", key: "medium", weight: 500 },
  { file: "Inter-SemiBold.ttf", key: "semibold", weight: 600 },
  { file: "Inter-Bold.ttf", key: "bold", weight: 700 },
];

function registerFonts(pdf, fonts) {
  FONT_WEIGHTS.forEach(({ file, key, weight }) => {
    pdf.addFileToVFS(file, fonts[key]);
    pdf.addFont(file, "Inter", "normal", weight);
  });

  const styles = pdf.getFontList().Inter;
  const missing = ["normal", "500normal", "600normal", "bold"].filter(
    (style) => !styles?.includes(style)
  );
  if (missing.length) {
    throw new Error(`Inter is missing PDF styles: ${missing.join(", ")}`);
  }
}

function renderSvgElement(layout, palette) {
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText =
    "position:absolute;left:-100000px;top:0;width:0;height:0;overflow:hidden;";
  document.body.appendChild(holder);
  return { holder, element: createElement(ChartSvg, { layout, palette, scale: 1 }) };
}

async function loadImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function drawHeader(pdf, { title, subtitle, logo, logoDataUrl, pageWidth }) {
  let textLeft = MARGIN;

  if (logo) {
    const maxH = 30;
    const maxW = 96;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    pdf.addImage(logoDataUrl, MARGIN, MARGIN - 4, w, h, undefined, "FAST");
    textLeft = MARGIN + w + 14;
  }

  pdf.setFont("Inter", "normal", 700);
  pdf.setFontSize(15);
  pdf.setTextColor(PAPER.ink);
  pdf.text(title, textLeft, MARGIN + 12);

  if (subtitle) {
    pdf.setFont("Inter", "normal", 400);
    pdf.setFontSize(10);
    pdf.setTextColor(PAPER.ink2);
    pdf.text(subtitle, textLeft, MARGIN + 27);
  }

  pdf.setDrawColor(214, 220, 230);
  pdf.setLineWidth(0.75);
  pdf.line(MARGIN, MARGIN + HEADER_H - 14, pageWidth - MARGIN, MARGIN + HEADER_H - 14);
}

function drawFooter(pdf, { left, right, pageWidth, pageHeight }) {
  pdf.setFont("Inter", "normal", 400);
  pdf.setFontSize(8.5);
  pdf.setTextColor(PAPER.ink2);
  const y = pageHeight - MARGIN + 6;
  if (left) pdf.text(left, MARGIN, y);
  if (right) pdf.text(right, pageWidth - MARGIN, y, { align: "right" });
}

/**
 * @param {Array}  model        card tree from buildChartModel
 * @param {Object} palette      category colours
 * @param {Object} options      title, logoDataUrl, fileName, generatedOn
 */
export async function exportChartToPdf({
  model,
  palette,
  title = "Organizational Chart",
  logoDataUrl = "",
  fileName = "org-chart.pdf",
  generatedOn = new Date(),
  footerNote = "",
}) {
  if (!model?.length) throw new Error("There is no chart to export.");

  const { svg2pdf } = await import("svg2pdf.js");
  const { renderToStaticMarkup } = await import("react-dom/server");

  const fonts = await loadFonts();
  const pdf = new jsPDF({ ...PAGE, unit: "pt" });
  registerFonts(pdf, fonts);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const box = {
    x: MARGIN,
    y: MARGIN + HEADER_H,
    width: pageWidth - MARGIN * 2,
    height: pageHeight - MARGIN * 2 - HEADER_H - FOOTER_H,
  };

  const pages = planPages(model, box);
  if (!pages.length) throw new Error("There is no chart to export.");

  const logo = logoDataUrl ? await loadImage(logoDataUrl) : null;
  const stamp = generatedOn.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (index > 0) pdf.addPage(PAGE.format, PAGE.orientation);

    drawHeader(pdf, {
      title,
      subtitle: page.title,
      logo,
      logoDataUrl,
      pageWidth,
    });

    const scale = fitScale(page.layout, box);
    const drawWidth = page.layout.width * scale;
    const drawHeight = page.layout.height * scale;

    const { holder, element } = renderSvgElement(page.layout, palette);
    try {
      holder.innerHTML = renderToStaticMarkup(element);
      const svg = holder.querySelector("svg");
      await svg2pdf(svg, pdf, {
        x: box.x + (box.width - drawWidth) / 2,
        y: box.y + (box.height - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight,
      });
    } finally {
      holder.remove();
    }

    drawFooter(pdf, {
      left: footerNote || `Generated ${stamp}`,
      right: pages.length > 1 ? `Page ${index + 1} of ${pages.length}` : "",
      pageWidth,
      pageHeight,
    });
  }

  pdf.save(fileName);
  return { pages: pages.length };
}
