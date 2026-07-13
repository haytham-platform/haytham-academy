import mongoose from "mongoose";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { connectDB } from "@/lib/db";
import { createStudentBehavior } from "@/lib/students";
import { StudentBehavior } from "@/models/StudentRecords";

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("students.manage_behavior");
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const filter: Record<string, unknown> = {};
    const studentId = searchParams.get("studentId");
    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) return errorResponse("Invalid student id");
      filter.studentId = new mongoose.Types.ObjectId(studentId);
    }
    const type = searchParams.get("type");
    const resolutionStatus = searchParams.get("resolutionStatus");
    if (type) filter.type = type;
    if (resolutionStatus) filter.resolutionStatus = resolutionStatus;
    await connectDB();
    const records = await StudentBehavior.find(filter).sort({ occurredAt: -1 }).limit(100).lean();
    return successResponse({ records });
  } catch (error) {
    return handleRouteError("Student behavior GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("students.manage_behavior");
    if (error) return error;
    const body = await request.json();
    await connectDB();
    const record = await createStudentBehavior(body, user!._id);
    return successResponse({ record }, 201);
  } catch (error) {
    return handleRouteError("Student behavior POST", error);
  }
}
