export const PAYMENT_METHODS = [
  { value: "cash", label: "نقداً" },
  { value: "baridimob", label: "BaridiMob" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "other", label: "أخرى" },
] as const;

export const PAYMENT_TYPES = [
  { value: "course_fee", label: "رسوم دورة" },
  { value: "registration_fee", label: "رسوم تسجيل" },
  { value: "other", label: "أخرى" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "rent", label: "إيجار" },
  { value: "salary", label: "رواتب" },
  { value: "utilities", label: "مرافق" },
  { value: "marketing", label: "تسويق" },
  { value: "equipment", label: "معدات" },
  { value: "maintenance", label: "صيانة" },
  { value: "other", label: "أخرى" },
] as const;

export const PAYOUT_TYPES = [
  { value: "fixed", label: "مبلغ ثابت" },
  { value: "percentage", label: "نسبة" },
  { value: "per_session", label: "لكل حصة" },
  { value: "other", label: "أخرى" },
] as const;

export const LESSON_PAYMENT_STATUSES = [
  { value: "paid", label: "مدفوع" },
  { value: "unpaid", label: "غير مدفوع" },
  { value: "partial", label: "مدفوع جزئياً" },
] as const;

export const SESSION_COUNTS = [
  { value: "1", label: "1 حصة" },
  { value: "2", label: "2 حصص" },
  { value: "3", label: "3 حصص" },
  { value: "4", label: "4 حصص" },
] as const;

export function formatCurrency(amount: number) {
  return `${amount.toLocaleString("ar-DZ")} د.ج`;
}

export function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("ar-DZ");
}

export function labelOf(
  list: readonly { value: string; label: string }[],
  value: string
) {
  return list.find((i) => i.value === value)?.label ?? value;
}
