import mongoose from "mongoose";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { connectDB } from "@/lib/db";
import { createStudentAttendance } from "@/lib/students";
import { StudentAttendance } from "@/models/StudentRecords";

function buildFilter(searchParams: URLSearchParams) {
  const filter: Record<string, unknown> = {};
  const studentId = searchParams.get("studentId");
  const status = searchParams.get("status");
  const contextType = searchParams.get("contextType");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (studentId) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) return null;
    filter.studentId = new mongoose.Types.ObjectId(studentId);
  }
  if (status) filter.status = status;
  if (contextType) filter.contextType = contextType;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);
    filter.date = range;
  }
  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("students.manage_attendance");
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const filter = buildFilter(searchParams);
    if (!filter) return errorResponse("Invalid student id");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    await connectDB();
    const [records, total] = await Promise.all([
      StudentAttendance.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      StudentAttendance.countDocuments(filter),
    ]);
    return successResponse({ records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    return handleRouteError("Student attendance GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("students.manage_attendance");
    if (error) return error;
    const body = await request.json();
    await connectDB();
    if (Array.isArray(body.records)) {
      const records: Awaited<ReturnType<typeof createStudentAttendance>>[] = [];
      for (const record of body.records) {
        records.push(await createStudentAttendance(record, user!._id));
      }
      return successResponse({ records }, 201);
    }
    const record = await createStudentAttendance(body, user!._id);
    return successResponse({ record }, 201);
  } catch (error) {
    return handleRouteError("Student attendance POST", error);
  }
}
