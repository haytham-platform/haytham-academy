"use client";

import { Eye, FileText, Printer } from "lucide-react";
import AcademyLogo from "@/components/ui/AcademyLogo";
import { formatCurrency, formatDate, labelOf, PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/finance-labels";

export type FinancialDocumentKind =
  | "student_invoice"
  | "student_payment_receipt"
  | "teacher_invoice"
  | "teacher_payment_receipt";

export interface FinancialDocumentField {
  label: string;
  value: string;
  wide?: boolean;
}

export interface FinancialDocumentAllocation {
  label: string;
  amount: string;
}

export interface FinancialDocumentData {
  kind: FinancialDocumentKind;
  title: string;
  number: string;
  date?: string;
  filename: string;
  fields: FinancialDocumentField[];
  notes?: string;
  preparedBy?: string;
  verificationId?: string;
  allocations?: FinancialDocumentAllocation[];
}

interface StudentInvoiceDocumentInput {
  _id: string;
  studentName?: string;
  teacherName?: string;
  courseTitle?: string;
  subject?: string;
  sessionCount: number;
  pricePerSession?: number;
  totalAmount: number;
  invoiceDate: string;
  note?: string;
  createdBy?: string;
}

interface TeacherInvoiceDocumentInput {
  _id: string;
  teacherName?: string;
  courseTitle?: string;
  subject?: string;
  invoicePeriod?: string;
  numberOfSessions: number;
  sessionRate: number;
  grossAmount?: number;
  administrationShare?: number;
  teacherShareAmount?: number;
  netTeacherAmount?: number;
  payoutDate: string;
  note?: string;
  createdBy?: string;
}

interface StudentPaymentDocumentInput {
  _id: string;
  receiptNumber?: string;
  studentName?: string;
  courseTitle?: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  type: string;
  note?: string;
  createdBy?: string;
}

interface TeacherPaymentDocumentInput {
  _id: string;
  receiptNumber: string;
  teacherName?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  createdBy?: string;
  remainingAfterPayment: number;
  allocations?: {
    invoiceId: string;
    amount: number;
    invoicePeriod?: string;
    courseTitle?: string;
  }[];
}

export function createStudentInvoiceDocument(invoice: StudentInvoiceDocumentInput): FinancialDocumentData {
  return {
    kind: "student_invoice",
    title: "فاتورة طالب",
    number: documentNumber("SINV", invoice._id),
    date: invoice.invoiceDate,
    filename: `student-invoice-${documentNumber("SINV", invoice._id)}`,
    verificationId: invoice._id,
    preparedBy: invoice.createdBy || "الإدارة",
    notes: invoice.note,
    fields: [
      { label: "رقم الفاتورة", value: documentNumber("SINV", invoice._id) },
      { label: "تاريخ الفاتورة", value: formatDate(invoice.invoiceDate) },
      { label: "الطالب", value: invoice.studentName || "—" },
      { label: "الدورة", value: invoice.courseTitle || "—" },
      { label: "المادة", value: invoice.subject || "—" },
      { label: "الأستاذ", value: invoice.teacherName || "—" },
      { label: "عدد الحصص", value: String(invoice.sessionCount || 0) },
      { label: "سعر الحصة", value: formatCurrency(invoice.pricePerSession || 0) },
      { label: "المبلغ الإجمالي", value: formatCurrency(invoice.totalAmount || 0), wide: true },
    ],
  };
}

export function createTeacherInvoiceDocument(invoice: TeacherInvoiceDocumentInput): FinancialDocumentData {
  return {
    kind: "teacher_invoice",
    title: "فاتورة أستاذ",
    number: documentNumber("TINV", invoice._id),
    date: invoice.payoutDate,
    filename: `teacher-invoice-${documentNumber("TINV", invoice._id)}`,
    verificationId: invoice._id,
    preparedBy: invoice.createdBy || "الإدارة",
    notes: invoice.note,
    fields: [
      { label: "رقم الفاتورة", value: documentNumber("TINV", invoice._id) },
      { label: "الأستاذ", value: invoice.teacherName || "—" },
      { label: "المادة", value: invoice.subject || "—" },
      { label: "الدورة", value: invoice.courseTitle || "—" },
      { label: "الفترة", value: invoice.invoicePeriod || "—" },
      { label: "عدد الحصص", value: String(invoice.numberOfSessions || 0) },
      { label: "سعر الحصة", value: formatCurrency(invoice.sessionRate || 0) },
      { label: "المبلغ الإجمالي", value: formatCurrency(invoice.grossAmount || 0) },
      { label: "حصة الإدارة", value: formatCurrency(invoice.administrationShare || 0) },
      { label: "حصة الأستاذ", value: formatCurrency(invoice.teacherShareAmount || invoice.netTeacherAmount || 0) },
      { label: "تاريخ الفاتورة", value: formatDate(invoice.payoutDate) },
    ],
  };
}

export function createStudentPaymentDocument(payment: StudentPaymentDocumentInput): FinancialDocumentData {
  const receiptNumber = payment.receiptNumber || documentNumber("REC", payment._id);
  return {
    kind: "student_payment_receipt",
    title: "وصل دفع طالب",
    number: receiptNumber,
    date: payment.paymentDate,
    filename: `student-payment-${receiptNumber}`,
    verificationId: payment._id,
    preparedBy: payment.createdBy || "الإدارة",
    notes: payment.note,
    fields: [
      { label: "رقم الوصل", value: receiptNumber },
      { label: "الطالب", value: payment.studentName || "—" },
      { label: "الدورة", value: payment.courseTitle || "—" },
      { label: "تاريخ الدفع", value: formatDate(payment.paymentDate) },
      { label: "طريقة الدفع", value: labelOf(PAYMENT_METHODS, payment.paymentMethod) },
      { label: "نوع الدفع", value: labelOf(PAYMENT_TYPES, payment.type || "") || "—" },
      { label: "المبلغ المدفوع", value: formatCurrency(payment.amount || 0), wide: true },
    ],
  };
}

export function createTeacherPaymentDocument(payment: TeacherPaymentDocumentInput): FinancialDocumentData {
  return {
    kind: "teacher_payment_receipt",
    title: "وصل دفع أستاذ",
    number: payment.receiptNumber,
    date: payment.paymentDate,
    filename: `teacher-payment-${payment.receiptNumber}`,
    verificationId: payment._id,
    preparedBy: payment.createdBy || "الإدارة",
    notes: payment.notes,
    fields: [
      { label: "رقم الوصل", value: payment.receiptNumber },
      { label: "الأستاذ", value: payment.teacherName || "—" },
      { label: "تاريخ الدفع", value: formatDate(payment.paymentDate) },
      { label: "طريقة الدفع", value: labelOf(PAYMENT_METHODS, payment.paymentMethod) },
      { label: "المبلغ المدفوع", value: formatCurrency(payment.amount || 0) },
      { label: "المبلغ المتبقي", value: formatCurrency(payment.remainingAfterPayment || 0) },
      { label: "رقم المرجع", value: payment.referenceNumber || "—" },
    ],
    allocations: (payment.allocations || []).map((allocation) => ({
      label: `${allocation.courseTitle || "—"} — ${allocation.invoicePeriod || allocation.invoiceId}`,
      amount: formatCurrency(allocation.amount || 0),
    })),
  };
}

export function FinancialDocumentView({ document }: { document: FinancialDocumentData }) {
  return (
    <article className="financial-document mx-auto max-w-3xl bg-white p-6 text-right text-foreground print:p-0" dir="rtl">
      <DocumentHeader document={document} />
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {document.fields.map((field) => (
          <div key={`${field.label}-${field.value}`} className={field.wide ? "sm:col-span-2" : undefined}>
            <dt className="text-xs font-medium text-muted print:text-gray-600">{field.label}</dt>
            <dd className="mt-1 rounded-xl border border-border bg-gray-50 px-3 py-2 text-sm font-semibold print:border-gray-300 print:bg-white">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>

      {document.allocations?.length ? (
        <section className="mt-6 rounded-xl border border-border p-4 print:border-gray-300">
          <h3 className="mb-3 font-bold">الفواتير المرتبطة</h3>
          <div className="space-y-2 text-sm">
            {document.allocations.map((allocation) => (
              <div key={`${allocation.label}-${allocation.amount}`} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
                <span>{allocation.label}</span>
                <strong>{allocation.amount}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {document.notes ? (
        <section className="mt-6 rounded-xl border border-border p-4 text-sm print:border-gray-300">
          <h3 className="mb-2 font-bold">الملاحظات</h3>
          <p className="whitespace-pre-wrap text-muted print:text-black">{document.notes}</p>
        </section>
      ) : null}

      <footer className="mt-10 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted print:text-gray-600">أعد بواسطة</p>
          <p className="mt-1 font-semibold">{document.preparedBy || "الإدارة"}</p>
        </div>
        <div>
          <p className="text-xs text-muted print:text-gray-600">التوقيع والختم</p>
          <div className="mt-8 border-t border-border pt-2 print:border-gray-400"> </div>
        </div>
      </footer>
    </article>
  );
}

export function DocumentActionButtons({
  document,
  onView,
}: {
  document: FinancialDocumentData;
  onView: (document: FinancialDocumentData) => void;
}) {
  return (
    <>
      <button type="button" onClick={() => onView(document)} className="text-muted" title="عرض">
        <Eye className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => printFinancialDocument(document)} className="text-primary" title="طباعة">
        <Printer className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => exportFinancialDocumentPdf(document)} className="text-green-700" title="تصدير PDF">
        <FileText className="h-4 w-4" />
      </button>
    </>
  );
}

export function printFinancialDocument(document: FinancialDocumentData) {
  openPrintableDocument(document, "print");
}

export function exportFinancialDocumentPdf(document: FinancialDocumentData) {
  openPrintableDocument(document, "pdf");
}

function DocumentHeader({ document }: { document: FinancialDocumentData }) {
  return (
    <header className="border-b border-border pb-5 print:border-gray-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <AcademyLogo href="/admin/finance" size="lg" />
          <p className="mt-2 text-xs text-muted print:text-gray-600">وثيقة مالية رسمية</p>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-primary print:text-black">{document.title}</h2>
          <p className="mt-1 text-sm font-semibold">{document.number}</p>
          {document.date ? <p className="text-xs text-muted print:text-gray-600">{formatDate(document.date)}</p> : null}
        </div>
      </div>
      {document.verificationId ? (
        <div className="mt-4 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted print:border-gray-400 print:text-gray-600">
          معرف التحقق: {document.verificationId}
        </div>
      ) : null}
    </header>
  );
}

function openPrintableDocument(document: FinancialDocumentData, mode: "print" | "pdf") {
  const popup = window.open("", "_blank", "width=900,height=1200");
  if (!popup) {
    window.alert("تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.");
    return;
  }
  popup.document.open();
  popup.document.write(renderPrintableHtml(document, mode));
  popup.document.close();
  popup.focus();
}

function renderPrintableHtml(document: FinancialDocumentData, mode: "print" | "pdf") {
  const rows = document.fields
    .map(
      (field) => `
        <div class="${field.wide ? "field wide" : "field"}">
          <dt>${escapeHtml(field.label)}</dt>
          <dd>${escapeHtml(field.value)}</dd>
        </div>`
    )
    .join("");
  const allocations = document.allocations?.length
    ? `<section class="box">
        <h3>الفواتير المرتبطة</h3>
        ${document.allocations
          .map(
            (allocation) => `
            <div class="allocation">
              <span>${escapeHtml(allocation.label)}</span>
              <strong>${escapeHtml(allocation.amount)}</strong>
            </div>`
          )
          .join("")}
      </section>`
    : "";
  const notes = document.notes
    ? `<section class="box"><h3>الملاحظات</h3><p>${escapeHtml(document.notes)}</p></section>`
    : "";
  const title = mode === "pdf" ? `${document.filename}.pdf` : document.filename;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f8fafc;
      color: #111827;
      font-family: Arial, "Tahoma", sans-serif;
      direction: rtl;
    }
    .toolbar {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 16px;
    }
    .toolbar button {
      border: 0;
      border-radius: 12px;
      background: #9b005d;
      color: white;
      cursor: pointer;
      font-weight: 700;
      padding: 10px 18px;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto 24px;
      background: white;
      padding: 18mm;
      box-shadow: 0 10px 30px rgb(15 23 42 / 0.12);
    }
    header {
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 18px;
    }
    .header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
    }
    .logo-mark {
      align-items: center;
      background: #9b005d;
      border-radius: 999px;
      color: #fff;
      display: inline-flex;
      font-weight: 800;
      height: 42px;
      justify-content: center;
      margin-left: 10px;
      width: 42px;
    }
    .academy-name {
      color: #9b005d;
      font-size: 18px;
      font-weight: 800;
      margin: 0;
    }
    .academy-en {
      color: #6b7280;
      font-size: 12px;
      margin: 2px 0 0;
    }
    h1 {
      color: #9b005d;
      font-size: 28px;
      margin: 0;
      text-align: left;
    }
    .doc-meta {
      font-size: 13px;
      font-weight: 700;
      margin-top: 6px;
      text-align: left;
    }
    .verify {
      border: 1px dashed #d1d5db;
      border-radius: 12px;
      color: #6b7280;
      font-size: 12px;
      margin-top: 14px;
      padding: 9px 12px;
    }
    dl {
      display: grid;
      gap: 12px;
      grid-template-columns: 1fr 1fr;
      margin: 24px 0 0;
    }
    .field.wide { grid-column: span 2; }
    dt {
      color: #6b7280;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    dd {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      margin: 0;
      padding: 10px 12px;
    }
    .box {
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      margin-top: 24px;
      padding: 14px;
      break-inside: avoid;
    }
    .box h3 {
      font-size: 15px;
      margin: 0 0 10px;
    }
    .box p {
      color: #374151;
      font-size: 13px;
      margin: 0;
      white-space: pre-wrap;
    }
    .allocation {
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding: 8px 0;
    }
    .allocation:last-child { border-bottom: 0; }
    footer {
      display: grid;
      gap: 40px;
      grid-template-columns: 1fr 1fr;
      margin-top: 44px;
    }
    .muted {
      color: #6b7280;
      font-size: 12px;
      font-weight: 700;
    }
    .signature {
      border-top: 1px solid #9ca3af;
      margin-top: 36px;
      padding-top: 8px;
    }
    @media print {
      body { background: white; }
      .toolbar { display: none; }
      .page {
        box-shadow: none;
        margin: 0;
        min-height: auto;
        padding: 0;
        width: auto;
      }
      h1, .academy-name { color: #111827; }
      dd { background: white; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">${mode === "pdf" ? "تصدير PDF" : "طباعة"}</button>
  </div>
  <main class="page">
    <header>
      <div class="header-row">
        <div>
          <div><span class="logo-mark">HA</span><span class="academy-name">أكاديمية هيثم التعليمية</span></div>
          <p class="academy-en">Haytham Academy</p>
          <p class="academy-en">وثيقة مالية رسمية</p>
        </div>
        <div>
          <h1>${escapeHtml(document.title)}</h1>
          <div class="doc-meta">${escapeHtml(document.number)}</div>
          ${document.date ? `<div class="doc-meta">${escapeHtml(formatDate(document.date))}</div>` : ""}
        </div>
      </div>
      ${document.verificationId ? `<div class="verify">معرف التحقق: ${escapeHtml(document.verificationId)}</div>` : ""}
    </header>
    <dl>${rows}</dl>
    ${allocations}
    ${notes}
    <footer>
      <div>
        <div class="muted">أعد بواسطة</div>
        <strong>${escapeHtml(document.preparedBy || "الإدارة")}</strong>
      </div>
      <div>
        <div class="muted">التوقيع والختم</div>
        <div class="signature"></div>
      </div>
    </footer>
  </main>
  <script>
    window.addEventListener("load", () => setTimeout(() => window.print(), 250));
  </script>
</body>
</html>`;
}

function documentNumber(prefix: string, id: string) {
  return `${prefix}-${id.slice(-8).toUpperCase()}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
