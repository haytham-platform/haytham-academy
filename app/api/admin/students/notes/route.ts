import mongoose from "mongoose";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { connectDB } from "@/lib/db";
import { createStudentNote } from "@/lib/students";
import { StudentNote } from "@/models/StudentRecords";

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("students.manage_notes");
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const filter: Record<string, unknown> = {};
    const studentId = searchParams.get("studentId");
    if (studentId) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) return errorResponse("Invalid student id");
      filter.studentId = new mongoose.Types.ObjectId(studentId);
    }
    const category = searchParams.get("category");
    if (category) filter.category = category;
    await connectDB();
    const records = await StudentNote.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return successResponse({ records });
  } catch (error) {
    return handleRouteError("Student notes GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("students.manage_notes");
    if (error) return error;
    const body = await request.json();
    await connectDB();
    const record = await createStudentNote(body, user!._id);
    return successResponse({ record }, 201);
  } catch (error) {
    return handleRouteError("Student notes POST", error);
  }
}
