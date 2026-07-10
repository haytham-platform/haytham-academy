export const DECIMAL_TOLERANCE = 0.01;

export function normalizeDecimalInput(value: unknown) {
  return String(value ?? "").trim().replace(",", ".");
}

export function parseDecimal(value: unknown, fallback = 0) {
  const normalized = normalizeDecimalInput(value);
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseOptionalDecimal(value: unknown) {
  const normalized = normalizeDecimalInput(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function decimalsSumTo100(first: number, second: number) {
  return Math.abs(round2(first + second) - 100) <= DECIMAL_TOLERANCE;
}
