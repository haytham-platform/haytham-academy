import mongoose from "mongoose";
import { StudentCharge } from "@/models/StudentFinance";
import { requireStudentFinanceManage, requireStudentFinanceView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination, parseSort } from "@/lib/pagination";
import { connectDB } from "@/lib/db";
import { createStudentCharge, formatStudentCharge } from "@/lib/student-finance";

function buildFilter(searchParams: URLSearchParams) {
  const filter: Record<string, unknown> = {};
  const studentId = searchParams.get("studentId");
  const courseId = searchParams.get("courseId");
  const status = searchParams.get("status");
  const season = searchParams.get("season");
  const type = searchParams.get("type");
  const overdue = searchParams.get("overdue");
  if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter.studentId = new mongoose.Types.ObjectId(studentId);
  if (courseId && mongoose.Types.ObjectId.isValid(courseId)) filter.courseId = new mongoose.Types.ObjectId(courseId);
  if (status) filter.status = status;
  if (season) filter.academicSeason = season;
  if (type) filter.chargeType = type;
  if (overdue === "true") filter.status = "overdue";
  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requireStudentFinanceView();
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["dueDate", "createdAt", "finalAmountMinor", "balanceMinor"], "dueDate");
    await connectDB();
    const filter = buildFilter(searchParams);
    const [charges, total] = await Promise.all([
      StudentCharge.find(filter)
        .populate("studentId", "name phone academicLevel studyLevel")
        .populate("courseId", "title level")
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      StudentCharge.countDocuments(filter),
    ]);
    return successResponse({ charges: charges.map(formatStudentCharge), pagination: buildPaginationMeta(total, pagination) });
  } catch (err) {
    console.error("Student charges GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireStudentFinanceManage();
    if (error) return error;
    const charge = await createStudentCharge(await request.json(), user!._id);
    return successResponse({ charge }, 201);
  } catch (err) {
    console.error("Student charge POST:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 400);
  }
}
