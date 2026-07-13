import mongoose from "mongoose";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { connectDB } from "@/lib/db";
import { createStudentPerformance } from "@/lib/students";
import { StudentPerformance } from "@/models/StudentRecords";

function buildFilter(searchParams: URLSearchParams) {
  const filter: Record<string, unknown> = {};
  const studentId = searchParams.get("studentId");
  if (studentId) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) return null;
    filter.studentId = new mongoose.Types.ObjectId(studentId);
  }
  for (const key of ["subject", "academicSeason", "academicPeriod", "type"]) {
    const value = searchParams.get(key);
    if (value) filter[key] = value;
  }
  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("students.manage_grades");
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const filter = buildFilter(searchParams);
    if (!filter) return errorResponse("Invalid student id");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    await connectDB();
    const [records, total] = await Promise.all([
      StudentPerformance.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      StudentPerformance.countDocuments(filter),
    ]);
    return successResponse({ records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    return handleRouteError("Student performance GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("students.manage_grades");
    if (error) return error;
    const body = await request.json();
    await connectDB();
    const record = await createStudentPerformance(body, user!._id);
    return successResponse({ record }, 201);
  } catch (error) {
    return handleRouteError("Student performance POST", error);
  }
}
