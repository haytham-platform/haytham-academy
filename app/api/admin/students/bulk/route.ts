import mongoose from "mongoose";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { connectDB } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import User from "@/models/User";
import { STUDENT_STATUSES, normalizeStudentStatus, statusToIsActive } from "@/lib/students";
import type { StudentStatus } from "@/types";

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("students.update");
    if (error) return error;
    const body = await request.json();
    const ids = Array.isArray(body.studentIds) ? body.studentIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)) : [];
    if (!ids.length) return errorResponse("No valid students selected");
    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!STUDENT_STATUSES.includes(body.status as StudentStatus)) return errorResponse("Invalid student status");
      const status = normalizeStudentStatus(body.status, "active");
      updates.status = status;
      updates.isActive = statusToIsActive(status);
      if (status === "archived") updates.deletedAt = new Date();
    }
    for (const field of ["academicLevel", "className", "groupName", "academicSeason"]) {
      if (typeof body[field] === "string") updates[field] = body[field].trim();
    }
    if (!Object.keys(updates).length) return errorResponse("No valid bulk action provided");
    await connectDB();
    const result = await User.updateMany({ _id: { $in: ids }, role: "student" }, updates);
    await recordAudit({
      userId: user!._id,
      action: "student.bulk_update",
      recordType: "student",
      recordId: "bulk",
      metadata: { studentIds: ids, updates, modifiedCount: result.modifiedCount },
    });
    return successResponse({ modifiedCount: result.modifiedCount });
  } catch (error) {
    return handleRouteError("Student bulk POST", error);
  }
}
