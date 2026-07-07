import type { LessonPaymentStatus } from "@/models/LessonInvoice";

/** Normalize an id for strict equality checks (24-char hex ObjectId string). */
export function normalizeId(value: unknown): string {
  return refId(value).trim();
}

export function idsMatch(a: unknown, b: unknown): boolean {
  const left = normalizeId(a);
  const right = normalizeId(b);
  return Boolean(left && right && left === right);
}

/** Extract a MongoDB ObjectId string from a ref field (populated doc, ObjectId, or string). */
export function refId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as { _id?: unknown; toString?: () => string };
    if (obj._id) {
      if (typeof obj._id === "object" && obj._id !== null && "toString" in obj._id) {
        return String((obj._id as { toString(): string }).toString());
      }
      return String(obj._id);
    }
    if (typeof obj.toString === "function") {
      const s = obj.toString();
      if (/^[a-f\d]{24}$/i.test(s)) return s;
    }
  }
  return "";
}

export function derivePaymentStatus(
  paidAmount: number,
  totalAmount: number
): LessonPaymentStatus {
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount >= totalAmount) return "paid";
  return "partial";
}

export function computeTotalAmount(sessionCount: number, pricePerSession: number): number {
  return sessionCount * pricePerSession;
}

export function computeRemainingAmount(totalAmount: number, paidAmount: number): number {
  return Math.max(0, totalAmount - paidAmount);
}

export function parseSessionCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function validateLessonInvoiceInput(input: {
  studentId?: string;
  sessionCount: number | null;
  pricePerSession: number;
  paidAmount: number;
}): string | null {
  if (!input.studentId) return "يجب اختيار الطالب";
  if (!input.sessionCount) return "عدد الحصص يجب أن يكون رقماً صحيحاً أكبر من صفر";
  if (!Number.isFinite(input.pricePerSession) || input.pricePerSession <= 0) {
    return "سعر الحصة يجب أن يكون أكبر من صفر";
  }
  const total = computeTotalAmount(input.sessionCount, input.pricePerSession);
  if (input.paidAmount > total) {
    return "المبلغ المدفوع لا يمكن أن يكون أكبر من المبلغ الإجمالي";
  }
  return null;
}

export function parseMonthRange(month?: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { start: undefined, end: undefined };
  }
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const m = Number(monthStr);
  const start = new Date(year, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, m, 0, 23, 59, 59, 999);
  return { start, end };
}
