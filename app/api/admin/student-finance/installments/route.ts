import { StudentInstallmentPlan } from "@/models/StudentFinance";
import { requireStudentFinanceManage, requireStudentFinanceView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { connectDB } from "@/lib/db";
import { createInstallmentPlan, minorToAmount } from "@/lib/student-finance";

function formatPlan(row: unknown) {
  const record = row as Record<string, unknown>;
  return {
    _id: String(record._id),
    studentId: record.studentId?.toString?.() ?? record.studentId,
    totalAmount: minorToAmount(record.totalAmountMinor),
    numberOfInstallments: record.numberOfInstallments,
    installmentAmount: minorToAmount(record.installmentAmountMinor),
    paidAmount: minorToAmount(record.paidAmountMinor),
    remainingAmount: minorToAmount(record.remainingAmountMinor),
    status: record.status,
    lateStatus: record.lateStatus,
    academicSeason: record.academicSeason ?? "",
    installments: Array.isArray(record.installments)
      ? record.installments.map((item) => ({ dueDate: item.dueDate, amount: minorToAmount(item.amountMinor), paidAmount: minorToAmount(item.paidAmountMinor), status: item.status }))
      : [],
    notes: record.notes ?? "",
  };
}

export async function GET(request: Request) {
  try {
    const { error } = await requireStudentFinanceView();
    if (error) return error;
    const pagination = parsePagination(new URL(request.url).searchParams);
    await connectDB();
    const [plans, total] = await Promise.all([
      StudentInstallmentPlan.find().sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      StudentInstallmentPlan.countDocuments(),
    ]);
    return successResponse({ installments: plans.map(formatPlan), pagination: buildPaginationMeta(total, pagination) });
  } catch (err) {
    console.error("Student installments GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireStudentFinanceManage();
    if (error) return error;
    const plan = await createInstallmentPlan(await request.json(), user!._id);
    return successResponse({ installment: formatPlan(plan) }, 201);
  } catch (err) {
    console.error("Student installment POST:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 400);
  }
}
