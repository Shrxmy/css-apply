import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, PageSizes, rgb } from "pdf-lib";
import sharp from "sharp";
import { generateBarcodeSvg } from "@/lib/barcode-generator";
import { generateQRCodeSvg } from "@/lib/qr-generator";

const COLORS = {
  navy: rgb(19 / 255, 70 / 255, 135 / 255),
  blue: rgb(4 / 255, 79 / 255, 175 / 255),
  brightBlue: rgb(47 / 255, 126 / 255, 227 / 255),
  paleBlue: rgb(243 / 255, 248 / 255, 1),
  paleGray: rgb(248 / 255, 250 / 255, 1),
  ink: rgb(19 / 255, 70 / 255, 135 / 255),
  muted: rgb(99 / 255, 127 / 255, 166 / 255),
  white: rgb(1, 1, 1),
} as const;

const [PAGE_WIDTH, PAGE_HEIGHT] = PageSizes.A4;
const CARD_WIDTH = 53.98 * 2.834645669;
const CARD_HEIGHT = 85.6 * 2.834645669;
const CARD_X = (PAGE_WIDTH - CARD_WIDTH) / 2;
const CARD_Y = (PAGE_HEIGHT - CARD_HEIGHT) / 2;

export type DigitalIdPdfMember = {
  memberId: string;
  schoolYear: string;
  roleTitle: string;
  issueDate: Date;
  expirationDate?: Date | null;
  name: string;
  studentNumber: string;
  section: string;
  photo?: Buffer | null;
};

type Assets = {
  regular: PDFFont;
  bold: PDFFont;
  logo: Awaited<ReturnType<PDFDocument["embedPng"]>>;
  csar: Awaited<ReturnType<PDFDocument["embedPng"]>>;
};

let assetBuffersPromise: Promise<{
  regular: Buffer;
  bold: Buffer;
  logo: Buffer;
  csar: Buffer;
}> | null = null;

async function loadAssetBuffers() {
  if (!assetBuffersPromise) {
    const publicRoot = path.join(
      process.cwd(),
      "public",
      "assets",
      "css-apply-static-images",
      "assets",
    );
    assetBuffersPromise = Promise.all([
      readFile(path.join(publicRoot, "fonts", "Poppins-Regular.ttf")),
      readFile(path.join(publicRoot, "fonts", "Poppins-SemiBold.ttf")),
      sharp(path.join(publicRoot, "logos", "Logo_CSS_Blue.webp"))
        .png()
        .toBuffer(),
      sharp(path.join(publicRoot, "logos", "csar.webp"))
        .png()
        .toBuffer(),
    ]).then(([regular, bold, logo, csar]) => ({
      regular,
      bold,
      logo,
      csar,
    }));
  }
  return assetBuffersPromise;
}

async function svgToPng(svg: string, width: number, height: number) {
  return sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
}

function safeText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fitText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const text = safeText(value) || "N/A";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let shortened = text;
  while (
    shortened.length > 1 &&
    font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth
  ) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}...`;
}

function centeredText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  width: number,
  y: number,
  color = COLORS.ink,
) {
  const fitted = fitText(text, font, size, width);
  page.drawText(fitted, {
    x: x + (width - font.widthOfTextAtSize(fitted, size)) / 2,
    y,
    font,
    size,
    color,
  });
}

function dateLabel(value: Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(value);
}

function drawCardBase(
  page: PDFPage,
  x: number,
  y: number,
  fill = COLORS.white,
) {
  page.drawRectangle({
    x,
    y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    color: fill,
  });
}

async function drawFront(
  document: PDFDocument,
  page: PDFPage,
  member: DigitalIdPdfMember,
  assets: Assets,
) {
  const { regular, bold, logo } = assets;
  const x = CARD_X;
  const y = CARD_Y;
  const headerHeight = 28;
  const railWidth = 13;
  const contentX = x + 8;
  const contentWidth = CARD_WIDTH - railWidth - 16;
  const headerY = y + CARD_HEIGHT - headerHeight;

  drawCardBase(page, x, y);
  page.drawRectangle({
    x,
    y: headerY,
    width: CARD_WIDTH,
    height: headerHeight,
    color: COLORS.navy,
  });
  page.drawRectangle({
    x: x + CARD_WIDTH - railWidth,
    y,
    width: railWidth,
    height: CARD_HEIGHT - headerHeight,
    color: COLORS.blue,
  });

  page.drawRectangle({
    x: x + 7,
    y: headerY + 6,
    width: 17,
    height: 17,
    color: COLORS.white,
  });
  page.drawImage(logo, {
    x: x + 8.5,
    y: headerY + 7.5,
    width: 14,
    height: 14,
  });
  page.drawText("COMPUTER SCIENCE SOCIETY", {
    x: x + 28,
    y: headerY + 16,
    font: bold,
    size: 5.1,
    color: COLORS.white,
  });
  page.drawText("UST-CSS", {
    x: x + 28,
    y: headerY + 8,
    font: regular,
    size: 4.4,
    color: rgb(0.8, 0.9, 1),
  });
  page.drawRectangle({
    x: x + CARD_WIDTH - railWidth - 44,
    y: headerY + 8,
    width: 38,
    height: 12,
    color: COLORS.white,
  });
  page.drawText(`A.Y. ${fitText(member.schoolYear, regular, 4.3, 32)}`, {
    x: x + CARD_WIDTH - railWidth - 41,
    y: headerY + 12,
    font: bold,
    size: 4.3,
    color: COLORS.navy,
  });

  page.drawText("OFFICIAL MEMBER PASS", {
    x: contentX,
    y: headerY - 14,
    font: bold,
    size: 5.4,
    color: COLORS.navy,
  });
  page.drawLine({
    start: { x: contentX, y: headerY - 18 },
    end: { x: contentX + contentWidth, y: headerY - 18 },
    thickness: 0.6,
    color: rgb(0.84, 0.9, 0.97),
  });

  const photoSize = 45;
  const photoX = contentX + (contentWidth - photoSize) / 2;
  const photoY = headerY - 70;
  page.drawRectangle({
    x: photoX,
    y: photoY,
    width: photoSize,
    height: photoSize,
    color: COLORS.paleBlue,
    borderColor: COLORS.brightBlue,
    borderWidth: 1.3,
  });
  if (member.photo) {
    const photo = await document.embedPng(member.photo);
    page.drawImage(photo, {
      x: photoX + 1,
      y: photoY + 1,
      width: photoSize - 2,
      height: photoSize - 2,
    });
  } else {
    centeredText(
      page,
      "1X1 PHOTO",
      bold,
      5,
      photoX + 2,
      photoSize - 4,
      photoY + 20,
      COLORS.blue,
    );
  }

  const infoY = headerY - 139;
  const infoHeight = 55;
  page.drawRectangle({
    x: contentX,
    y: infoY,
    width: contentWidth,
    height: infoHeight,
    color: COLORS.paleGray,
  });
  const rows = [
    { value: member.name, size: 7, font: bold },
    { value: member.studentNumber, size: 5.4, font: bold },
    { value: member.roleTitle, size: 5.2, font: bold },
    { value: member.section, size: 5.4, font: regular },
    { value: member.memberId, size: 5.2, font: bold },
  ];
  const rowHeight = infoHeight / rows.length;
  rows.forEach((row, index) => {
    const rowY = infoY + infoHeight - (index + 1) * rowHeight;
    if (index > 0) {
      page.drawLine({
        start: { x: contentX, y: rowY + rowHeight },
        end: { x: contentX + contentWidth, y: rowY + rowHeight },
        thickness: 0.35,
        color: rgb(0.84, 0.9, 0.97),
      });
    }
    centeredText(
      page,
      row.value,
      row.font,
      row.size,
      contentX + 4,
      contentWidth - 8,
      rowY + (rowHeight - row.size) / 2 + 1,
      index === 2 || index === 4 ? COLORS.brightBlue : COLORS.ink,
    );
  });

  const qrSize = 42;
  const qrX = contentX;
  const qrY = y + 10;
  const qr = await document.embedPng(
    await svgToPng(
      generateQRCodeSvg(member.memberId, {
        color: "#0A376D",
        bgColor: "#ffffff",
        margin: 4,
      }),
      qrSize * 3,
      qrSize * 3,
    ),
  );
  page.drawRectangle({
    x: qrX - 1,
    y: qrY - 1,
    width: qrSize + 2,
    height: qrSize + 2,
    color: COLORS.white,
  });
  page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  page.drawText("SCAN TO VERIFY", {
    x: qrX + qrSize + 7,
    y: qrY + 29,
    font: bold,
    size: 5.1,
    color: COLORS.ink,
  });
  page.drawText("Confirm active CSS membership.", {
    x: qrX + qrSize + 7,
    y: qrY + 20,
    font: regular,
    size: 3.8,
    color: COLORS.muted,
  });
  page.drawText(`ISSUED ${dateLabel(member.issueDate)}`.toUpperCase(), {
    x: qrX + qrSize + 7,
    y: qrY + 10,
    font: regular,
    size: 3.7,
    color: COLORS.muted,
  });
  if (member.expirationDate) {
    page.drawText(
      `VALID THROUGH ${dateLabel(member.expirationDate)}`.toUpperCase(),
      {
        x: qrX + qrSize + 7,
        y: qrY + 3,
        font: bold,
        size: 3.5,
        color: COLORS.brightBlue,
      },
    );
  }
}

async function drawBack(
  document: PDFDocument,
  page: PDFPage,
  member: DigitalIdPdfMember,
  assets: Assets,
) {
  const { regular, bold, logo, csar } = assets;
  const x = CARD_X;
  const y = CARD_Y;
  drawCardBase(page, x, y, COLORS.blue);
  page.drawRectangle({
    x,
    y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    color: rgb(8 / 255, 43 / 255, 89 / 255),
    opacity: 0.62,
  });

  const logoSize = 52;
  page.drawImage(logo, {
    x: x + (CARD_WIDTH - logoSize) / 2,
    y: y + CARD_HEIGHT - 73,
    width: logoSize,
    height: logoSize,
    opacity: 0.95,
  });
  centeredText(
    page,
    "COMPUTER SCIENCE SOCIETY",
    bold,
    6.2,
    x + 8,
    CARD_WIDTH - 16,
    y + CARD_HEIGHT - 86,
    COLORS.white,
  );
  centeredText(
    page,
    "UNIVERSITY OF SANTO TOMAS",
    regular,
    4.2,
    x + 8,
    CARD_WIDTH - 16,
    y + CARD_HEIGHT - 96,
    rgb(0.8, 0.9, 1),
  );

  const barcode = await document.embedPng(
    await svgToPng(
      generateBarcodeSvg(member.memberId, {
        color: "#ffffff",
        height: 48,
        showText: true,
      }),
      360,
      48,
    ),
  );
  page.drawImage(barcode, {
    x: x + 13,
    y: y + 40,
    width: CARD_WIDTH - 26,
    height: 32,
  });
  page.drawLine({
    start: { x: x + 13, y: y + 35 },
    end: { x: x + CARD_WIDTH - 13, y: y + 35 },
    thickness: 0.45,
    color: rgb(0.55, 0.78, 1),
    opacity: 0.7,
  });
  centeredText(
    page,
    "PROPERTY OF THE COMPUTER SCIENCE SOCIETY",
    regular,
    3.3,
    x + 8,
    CARD_WIDTH - 16,
    y + 25,
    rgb(0.8, 0.9, 1),
  );
  page.drawImage(csar, {
    x: x + CARD_WIDTH - 25,
    y: y + 10,
    width: 15,
    height: 15,
    opacity: 0.8,
  });
}

export async function createDigitalIdPdf(members: DigitalIdPdfMember[]) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const buffers = await loadAssetBuffers();
  const regular = await document.embedFont(buffers.regular);
  const bold = await document.embedFont(buffers.bold);
  const assets: Assets = {
    regular,
    bold,
    logo: await document.embedPng(buffers.logo),
    csar: await document.embedPng(buffers.csar),
  };

  for (const member of members) {
    const front = document.addPage(PageSizes.A4);
    await drawFront(document, front, member, assets);
    const back = document.addPage(PageSizes.A4);
    await drawBack(document, back, member, assets);
  }

  return Buffer.from(await document.save());
}
