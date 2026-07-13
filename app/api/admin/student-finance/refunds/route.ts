import { StudentRefund } from "@/models/StudentFinance";
import { requireStudentFinanceRefund, requireStudentFinanceView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { connectDB } from "@/lib/db";
import { createStudentRefund, minorToAmount } from "@/lib/student-finance";

function formatRefund(row: unknown) {
  const record = row as Record<string, unknown>;
  return {
    _id: String(record._id),
    studentId: record.studentId?.toString?.() ?? record.studentId,
    originalPaymentId: record.originalPaymentId?.toString?.() ?? record.originalPaymentId,
    refundAmount: minorToAmount(record.refundAmountMinor),
    reason: record.reason,
    refundDate: record.refundDate,
    refundMethod: record.refundMethod,
    status: record.status,
    notes: record.notes ?? "",
  };
}

export async function GET(request: Request) {
  try {
    const { error } = await requireStudentFinanceView();
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    await connectDB();
    const [refunds, total] = await Promise.all([
      StudentRefund.find().sort({ refundDate: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      StudentRefund.countDocuments(),
    ]);
    return successResponse({ refunds: refunds.map(formatRefund), pagination: buildPaginationMeta(total, pagination) });
  } catch (err) {
    console.error("Student refunds GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireStudentFinanceRefund();
    if (error) return error;
    const refund = await createStudentRefund(await request.json(), user!._id);
    return successResponse({ refund: formatRefund(refund) }, 201);
  } catch (err) {
    console.error("Student refund POST:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 400);
  }
}
