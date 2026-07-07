import { NextResponse } from "next/server";

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export type ApiErrorBody = {
  error?: string;
  details?: string;
  validationErrors?: ValidationErrorItem[];
};

const FIELD_LABELS: Record<string, string> = {
  name: "الاسم",
  phone: "الهاتف",
  email: "البريد",
  password: "كلمة المرور",
  studentId: "الطالب",
  busId: "الحافلة",
  startDate: "تاريخ البداية",
  endDate: "تاريخ النهاية",
  pickupPoint: "نقطة الصعود",
  dropoffPoint: "نقطة النزول",
  plateNumber: "رقم اللوحة",
  driverId: "السائق",
  routeId: "خط السير",
};

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field;
}

/** Full server-side logging for route handlers */
export function logRouteError(context: string, err: unknown) {
  console.error(`[API Error] ${context}`);
  console.error(err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
}

function parseMongooseValidation(err: unknown): ValidationErrorItem[] {
  if (!err || typeof err !== "object") return [];
  const record = err as {
    name?: string;
    errors?: Record<string, { message?: string; path?: string }>;
  };
  if (record.name !== "ValidationError" || !record.errors) return [];

  return Object.values(record.errors).map((item) => {
    const field = item.path ?? "unknown";
    return {
      field,
      message: item.message ?? "قيمة غير صالحة",
    };
  });
}

function parseDuplicateKeyMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const record = err as {
    code?: number;
    keyPattern?: Record<string, unknown>;
  };
  if (record.code !== 11000) return null;

  const keys = Object.keys(record.keyPattern ?? {});
  if (keys.includes("phone")) return "رقم الهاتف مسجل مسبقاً";
  if (keys.includes("email")) return "البريد الإلكتروني مسجل مسبقاً";
  if (keys.includes("plateNumber")) return "رقم اللوحة مسجل مسبقاً";
  return "قيمة مكررة — هذا السجل موجود مسبقاً";
}

function extractErrorMessage(err: unknown): string | null {
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return null;
}

/** Build JSON error response with validation details when available */
export function handleRouteError(context: string, err: unknown, status = 500) {
  logRouteError(context, err);

  const duplicate = parseDuplicateKeyMessage(err);
  if (duplicate) {
    return NextResponse.json({ error: duplicate }, { status: 409 });
  }

  const validationErrors = parseMongooseValidation(err);
  if (validationErrors.length > 0) {
    const summary = validationErrors
      .map((v) => `${fieldLabel(v.field)}: ${v.message}`)
      .join(" — ");
    return NextResponse.json(
      {
        error: `فشل التحقق من البيانات — ${summary}`,
        validationErrors,
      },
      { status: 400 }
    );
  }

  const message = extractErrorMessage(err);
  if (message) {
    return NextResponse.json(
      { error: message, details: message },
      { status }
    );
  }

  return NextResponse.json({ error: "حدث خطأ غير متوقع" }, { status });
}

/** Parse API error JSON on the client */
export function parseApiErrorBody(
  data: ApiErrorBody,
  fallback = "حدث خطأ"
): { message: string; validationErrors?: ValidationErrorItem[] } {
  const validationErrors = data.validationErrors?.length
    ? data.validationErrors
    : undefined;

  if (data.error?.trim()) {
    return { message: data.error.trim(), validationErrors };
  }

  if (validationErrors?.length) {
    return {
      message: validationErrors
        .map((v) => `${fieldLabel(v.field)}: ${v.message}`)
        .join(" — "),
      validationErrors,
    };
  }

  if (data.details?.trim()) {
    return { message: data.details.trim(), validationErrors };
  }

  return { message: fallback, validationErrors };
}
