import * as fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit/js/pdfkit.standalone";
import QRCode from "qrcode";
import { getAcademySettings } from "@/lib/settings";

export interface ReceiptField {
  label: string;
  value: string | number;
}

export interface ReceiptDocument {
  title: string;
  receiptNumber: string;
  fields: ReceiptField[];
  layout?: "a4" | "thermal";
}

function clean(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text && !/[ÃØÙ�]/.test(text) ? text : fallback;
}

export async function getReceiptAcademyInfo() {
  const settings = await getAcademySettings().catch(() => null);
  return {
    name: clean(settings?.name, "أكاديمية هيثم التعليمية"),
    phone: clean(settings?.phone, "0676955623"),
    address: clean(settings?.address, "حاسي خليفة"),
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function qrDataUrl(receiptNumber: string) {
  return QRCode.toDataURL(receiptNumber, {
    margin: 1,
    width: 132,
    errorCorrectionLevel: "M",
  });
}

function pdfFontPath() {
  const candidates = [
    path.join(process.cwd(), "public", "fonts", "NotoNaskhArabic-Regular.ttf"),
    "C:\\Windows\\Fonts\\arial.ttf",
    "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function moneyLike(value: string | number) {
  return typeof value === "number" ? value.toLocaleString("ar-DZ") : String(value);
}

function drawQr(doc: PDFKit.PDFDocument, receiptNumber: string, x: number, y: number, size: number) {
  const qr = QRCode.create(receiptNumber, { errorCorrectionLevel: "M" }) as unknown as {
    modules: { size: number; data: Uint8Array };
  };
  const moduleSize = size / qr.modules.size;
  doc.save();
  doc.fillColor("#ffffff").rect(x, y, size, size).fill();
  doc.fillColor("#111827");
  qr.modules.data.forEach((filled, index) => {
    if (!filled) return;
    const col = index % qr.modules.size;
    const row = Math.floor(index / qr.modules.size);
    doc.rect(x + col * moduleSize, y + row * moduleSize, Math.ceil(moduleSize), Math.ceil(moduleSize)).fill();
  });
  doc.restore();
}

export async function receiptHtml(document: ReceiptDocument) {
  const academy = await getReceiptAcademyInfo();
  const qr = await qrDataUrl(document.receiptNumber);
  const rows = document.fields.map((field) => `
    <div class="field">
      <span>${escapeHtml(field.label)}</span>
      <strong>${escapeHtml(moneyLike(field.value))}</strong>
    </div>`).join("");
  const thermal = document.layout === "thermal";
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(document.title)} - ${escapeHtml(document.receiptNumber)}</title>
  <style>
    @page { size: ${thermal ? "80mm auto" : "A4"}; margin: ${thermal ? "4mm" : "14mm"}; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: white; }
    body { font-family: Arial, Tahoma, sans-serif; color: #111827; direction: rtl; }
    .receipt { width: ${thermal ? "72mm" : "100%"}; max-width: ${thermal ? "72mm" : "760px"}; margin: 0 auto; border: 1px solid #d1d5db; padding: ${thermal ? "10px" : "22px"}; border-radius: ${thermal ? "0" : "12px"}; }
    .header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
    .logo { width: 64px; height: 64px; border-radius: 16px; background: #be185d; color: white; display: grid; place-items: center; font-weight: 800; font-size: 24px; flex: 0 0 auto; }
    h1 { margin: 0; font-size: ${thermal ? "16px" : "22px"}; }
    .muted { color: #6b7280; font-size: 12px; margin-top: 4px; }
    .title { text-align: center; margin: 18px 0; }
    .title h2 { margin: 0; font-size: ${thermal ? "15px" : "20px"}; }
    .title p { margin: 6px 0 0; font-weight: 700; direction: ltr; }
    .qr { display: flex; justify-content: center; margin: 10px 0 16px; }
    .qr img { width: ${thermal ? "86px" : "112px"}; height: ${thermal ? "86px" : "112px"}; }
    .grid { display: grid; grid-template-columns: ${thermal ? "1fr" : "repeat(2, minmax(0, 1fr))"}; gap: 10px; }
    .field { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; min-height: 54px; }
    .field span { display: block; color: #6b7280; font-size: 12px; margin-bottom: 5px; }
    .field strong { font-size: 14px; overflow-wrap: anywhere; }
    .footer { margin-top: 22px; display: flex; justify-content: space-between; gap: 24px; font-size: 12px; color: #374151; }
    .sig { border-top: 1px solid #9ca3af; padding-top: 8px; min-width: 160px; text-align: center; }
    @media print {
      body { background: white; }
      .receipt { border-radius: 0; border-color: #9ca3af; }
      nav, aside, button, .no-print { display: none !important; }
    }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } .header { flex-direction: column; } }
  </style>
</head>
<body>
  <main class="receipt">
    <section class="header">
      <div>
        <h1>${escapeHtml(academy.name)}</h1>
        <div class="muted">${escapeHtml(academy.address)}</div>
        <div class="muted">${escapeHtml(academy.phone)}</div>
      </div>
      <div class="logo">هـ</div>
    </section>
    <section class="title">
      <h2>${escapeHtml(document.title)}</h2>
      <p>${escapeHtml(document.receiptNumber)}</p>
    </section>
    <section class="qr"><img alt="QR" src="${qr}" /></section>
    <section class="grid">${rows}</section>
    <section class="footer">
      <div>تاريخ الطباعة: ${new Date().toLocaleString("ar-DZ")}</div>
      <div class="sig">الختم والتوقيع</div>
    </section>
  </main>
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 250));</script>
</body>
</html>`;
}

export async function receiptPdf(document: ReceiptDocument) {
  const academy = await getReceiptAcademyInfo();
  const fontPath = pdfFontPath();
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({
    size: document.layout === "thermal" ? [226, 720] : "A4",
    margin: document.layout === "thermal" ? 14 : 42,
    info: {
      Title: `${document.title} ${document.receiptNumber}`,
      Author: academy.name,
      Subject: document.receiptNumber,
    },
  });

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  if (fontPath) {
    doc.registerFont("Arabic", fs.readFileSync(fontPath));
    doc.font("Arabic");
  }

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const right = doc.page.width - doc.page.margins.right;
  const logoX = doc.page.margins.left;

  doc.roundedRect(logoX, doc.y, 58, 58, 12).fill("#be185d");
  doc.fillColor("#ffffff").fontSize(24).text("هـ", logoX, doc.y - 44, { width: 58, align: "center" });
  doc.fillColor("#111827").fontSize(20).text(academy.name, doc.page.margins.left, 42, { width: pageWidth, align: "right" });
  doc.fontSize(10).fillColor("#4b5563").text(academy.address, { width: pageWidth, align: "right" });
  doc.text(academy.phone, { width: pageWidth, align: "right" });
  doc.moveDown(1.2).strokeColor("#111827").lineWidth(1.2).moveTo(doc.page.margins.left, doc.y).lineTo(right, doc.y).stroke();

  doc.moveDown(1.1).fillColor("#111827").fontSize(18).text(document.title, { width: pageWidth, align: "center" });
  doc.fontSize(12).text(document.receiptNumber, { width: pageWidth, align: "center" });
  drawQr(doc, document.receiptNumber, doc.page.margins.left + pageWidth / 2 - 44, doc.y + 8, 88);
  doc.moveDown(7);

  const fieldGap = 8;
  const twoCols = document.layout !== "thermal";
  const fieldWidth = twoCols ? (pageWidth - fieldGap) / 2 : pageWidth;
  const fieldHeight = 48;
  document.fields.forEach((field, index) => {
    const col = twoCols ? index % 2 : 0;
    const x = doc.page.margins.left + col * (fieldWidth + fieldGap);
    if (twoCols && col === 0 && index > 0) doc.y += fieldHeight + fieldGap;
    if (!twoCols && index > 0) doc.y += fieldHeight + fieldGap;
    const y = doc.y;
    doc.roundedRect(x, y, fieldWidth, fieldHeight, 8).strokeColor("#e5e7eb").stroke();
    doc.fillColor("#6b7280").fontSize(9).text(field.label, x + 10, y + 8, { width: fieldWidth - 20, align: "right" });
    doc.fillColor("#111827").fontSize(11).text(moneyLike(field.value), x + 10, y + 24, { width: fieldWidth - 20, align: "right" });
  });

  doc.y += fieldHeight + 28;
  doc.fillColor("#374151").fontSize(10).text(`تاريخ الطباعة: ${new Date().toLocaleString("ar-DZ")}`, { width: pageWidth, align: "right" });
  doc.moveDown(2).text("الختم والتوقيع", { width: pageWidth / 2, align: "center" });
  doc.end();
  return done;
}
