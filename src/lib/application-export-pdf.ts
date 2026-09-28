import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFImage, PDFPage, PageSizes, rgb } from "pdf-lib";

const COLORS = {
  navy: rgb(19 / 255, 70 / 255, 135 / 255),
  blue: rgb(4 / 255, 79 / 255, 175 / 255),
  paleBlue: rgb(243 / 255, 248 / 255, 1),
  line: rgb(214 / 255, 229 / 255, 247 / 255),
  ink: rgb(27 / 255, 48 / 255, 75 / 255),
  muted: rgb(92 / 255, 113 / 255, 139 / 255),
  white: rgb(1, 1, 1),
} as const;

const PAGE_MARGIN = 36;
const COLUMN_GAP = 10;
const FIELD_GAP = 7;
const FONT_SIZE = 8.5;
const LINE_HEIGHT = 11;

type ApplicationExportPdfInput = {
  title: string;
  subtitle: string;
  headers: string[];
  rows: string[][];
};

type PdfAssets = {
  logo: PDFImage;
  watermark: PDFImage;
};

async function loadAssets(document: PDFDocument): Promise<PdfAssets> {
  const logosPath = path.join(
    process.cwd(),
    "public",
    "assets",
    "css-apply-static-images",
    "assets",
    "logos",
  );
  const [logoBytes, watermarkBytes] = await Promise.all([
    readFile(path.join(logosPath, "Logo_CSS_Apply_Email.png")),
    readFile(path.join(logosPath, "Logo_CSS_Watermark.png")),
  ]);

  return {
    logo: await document.embedPng(logoBytes),
    watermark: await document.embedPng(watermarkBytes),
  };
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  if (!text) return ["—"];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = "";
    let chunk = "";
    for (const character of word) {
      const next = chunk + character;
      if (font.widthOfTextAtSize(next, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = character;
      } else {
        chunk = next;
      }
    }
    current = chunk;
  }

  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

function drawWatermark(page: PDFPage, watermark: PDFImage) {
  const size = 360;
  page.drawImage(watermark, {
    x: (PageSizes.A4[0] - size) / 2,
    y: (PageSizes.A4[1] - size) / 2 - 15,
    width: size,
    height: size,
    opacity: 0.055,
  });
}

function drawHeader(
  page: PDFPage,
  assets: PdfAssets,
  bold: PDFFont,
  regular: PDFFont,
  title: string,
  subtitle: string,
  pageNumber: number,
) {
  const pageWidth = PageSizes.A4[0];
  const pageHeight = PageSizes.A4[1];
  page.drawImage(assets.logo, {
    x: PAGE_MARGIN,
    y: pageHeight - 68,
    width: 116,
    height: 33,
  });
  page.drawText("CSSApply", {
    x: 166,
    y: pageHeight - 45,
    size: 17,
    font: bold,
    color: COLORS.navy,
  });
  page.drawText(title, {
    x: PAGE_MARGIN,
    y: pageHeight - 94,
    size: 15,
    font: bold,
    color: COLORS.navy,
  });
  page.drawText(subtitle, {
    x: PAGE_MARGIN,
    y: pageHeight - 110,
    size: 8.5,
    font: regular,
    color: COLORS.muted,
  });
  page.drawLine({
    start: { x: PAGE_MARGIN, y: pageHeight - 122 },
    end: { x: pageWidth - PAGE_MARGIN, y: pageHeight - 122 },
    thickness: 1.2,
    color: COLORS.blue,
  });
  page.drawText(`Page ${pageNumber}`, {
    x: pageWidth - PAGE_MARGIN - 38,
    y: 20,
    size: 7.5,
    font: regular,
    color: COLORS.muted,
  });
}

function drawField(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: COLORS.white,
    borderColor: COLORS.line,
    borderWidth: 0.7,
  });
  page.drawText(label.toUpperCase(), {
    x: x + 8,
    y: y + height - 14,
    size: 6.4,
    font: bold,
    color: COLORS.blue,
  });
  const lines = wrapText(value, regular, FONT_SIZE, width - 16);
  lines.slice(0, Math.max(1, Math.floor((height - 19) / LINE_HEIGHT))).forEach(
    (line, index) => {
      page.drawText(line, {
        x: x + 8,
        y: y + height - 27 - index * LINE_HEIGHT,
        size: FONT_SIZE,
        font: regular,
        color: COLORS.ink,
      });
    },
  );
}

export async function generateApplicationExportPdf({
  title,
  subtitle,
  headers,
  rows,
}: ApplicationExportPdfInput): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const assets = await loadAssets(document);
  const regular = await document.embedFont("Helvetica");
  const bold = await document.embedFont("Helvetica-Bold");
  const pageWidth = PageSizes.A4[0];
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  const columnWidth = (contentWidth - COLUMN_GAP) / 2;
  const generatedAt = new Date().toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
  const nameIndex = headers.findIndex((header) => header === "Name");

  if (rows.length === 0) {
    const page = document.addPage(PageSizes.A4);
    drawWatermark(page, assets.watermark);
    drawHeader(page, assets, bold, regular, title, subtitle, 1);
    page.drawText("No records matched this export.", {
      x: PAGE_MARGIN,
      y: PageSizes.A4[1] - 170,
      size: 12,
      font: regular,
      color: COLORS.muted,
    });
  }

  rows.forEach((row, rowIndex) => {
    const page = document.addPage(PageSizes.A4);
    drawWatermark(page, assets.watermark);
    const recordName = nameIndex >= 0 ? row[nameIndex] : `Record ${rowIndex + 1}`;
    drawHeader(
      page,
      assets,
      bold,
      regular,
      title,
      `${subtitle}  •  Record ${rowIndex + 1} of ${rows.length}`,
      rowIndex + 1,
    );

    page.drawRectangle({
      x: PAGE_MARGIN,
      y: PageSizes.A4[1] - 174,
      width: contentWidth,
      height: 30,
      color: COLORS.navy,
    });
    page.drawText(recordName || `Record ${rowIndex + 1}`, {
      x: PAGE_MARGIN + 10,
      y: PageSizes.A4[1] - 163,
      size: 11,
      font: bold,
      color: COLORS.white,
    });

    let y = PageSizes.A4[1] - 216;
    for (let index = 0; index < headers.length; index += 2) {
      const leftValue = row[index] || "—";
      const rightValue = row[index + 1] || "—";
      const leftLines = wrapText(leftValue, regular, FONT_SIZE, columnWidth - 16);
      const rightLines = wrapText(rightValue, regular, FONT_SIZE, columnWidth - 16);
      const height = Math.max(leftLines.length, rightLines.length, 1) * LINE_HEIGHT + 27;
      if (y - height < 40) break;
      drawField(page, regular, bold, headers[index], leftValue, PAGE_MARGIN, y - height, columnWidth, height);
      if (headers[index + 1]) {
        drawField(page, regular, bold, headers[index + 1], rightValue, PAGE_MARGIN + columnWidth + COLUMN_GAP, y - height, columnWidth, height);
      }
      y -= height + FIELD_GAP;
    }

    page.drawText(`Generated ${generatedAt}`, {
      x: PAGE_MARGIN,
      y: 20,
      size: 7.5,
      font: regular,
      color: COLORS.muted,
    });
  });

  document.setTitle(title);
  document.setAuthor("CSSApply");
  return document.save();
}
