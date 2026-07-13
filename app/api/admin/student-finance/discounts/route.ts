import { StudentDiscount } from "@/models/StudentFinance";
import { requireStudentFinanceDiscount, requireStudentFinanceView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { connectDB } from "@/lib/db";
import { createStudentDiscount, minorToAmount } from "@/lib/student-finance";

function formatDiscount(row: unknown) {
  const record = row as Record<string, unknown>;
  return {
    _id: String(record._id),
    studentId: record.studentId?.toString?.() ?? record.studentId,
    chargeId: record.chargeId?.toString?.() ?? record.chargeId ?? "",
    type: record.type,
    value: minorToAmount(record.valueMinor),
    percentage: record.percentage,
    appliedAmount: minorToAmount(record.appliedAmountMinor),
    reason: record.reason,
    approvalStatus: record.approvalStatus,
    effectiveDate: record.effectiveDate,
    notes: record.notes ?? "",
  };
}

export async function GET(request: Request) {
  try {
    const { error } = await requireStudentFinanceView();
    if (error) return error;
    const pagination = parsePagination(new URL(request.url).searchParams);
    await connectDB();
    const [discounts, total] = await Promise.all([
      StudentDiscount.find().sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      StudentDiscount.countDocuments(),
    ]);
    return successResponse({ discounts: discounts.map(formatDiscount), pagination: buildPaginationMeta(total, pagination) });
  } catch (err) {
    console.error("Student discounts GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireStudentFinanceDiscount();
    if (error) return error;
    const discount = await createStudentDiscount(await request.json(), user!._id);
    return successResponse({ discount: formatDiscount(discount) }, 201);
  } catch (err) {
    console.error("Student discount POST:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 400);
  }
}
