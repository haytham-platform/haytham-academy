import mongoose from "mongoose";
import { StudentPayment } from "@/models/StudentFinance";
import { requireStudentFinancePayment, requireStudentFinanceView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination, parseSort } from "@/lib/pagination";
import { connectDB } from "@/lib/db";
import { createStudentPayment, formatStudentPayment } from "@/lib/student-finance";

function filterFrom(searchParams: URLSearchParams) {
  const filter: Record<string, unknown> = {};
  const studentId = searchParams.get("studentId");
  const paymentMethod = searchParams.get("paymentMethod");
  const status = searchParams.get("status");
  const season = searchParams.get("season");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter.studentId = new mongoose.Types.ObjectId(studentId);
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (status) filter.status = status;
  if (season) filter.academicSeason = season;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    filter.paymentDate = range;
  }
  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requireStudentFinanceView();
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["paymentDate", "amountMinor", "createdAt"], "paymentDate");
    await connectDB();
    const filter = filterFrom(searchParams);
    const [payments, total] = await Promise.all([
      StudentPayment.find(filter)
        .populate("studentId", "name phone academicLevel studyLevel")
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      StudentPayment.countDocuments(filter),
    ]);
    return successResponse({ payments: payments.map(formatStudentPayment), pagination: buildPaginationMeta(total, pagination) });
  } catch (err) {
    console.error("Student payments GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireStudentFinancePayment();
    if (error) return error;
    const payment = await createStudentPayment(await request.json(), user!._id);
    return successResponse({ payment }, 201);
  } catch (err) {
    console.error("Student payment POST:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 400);
  }
}
