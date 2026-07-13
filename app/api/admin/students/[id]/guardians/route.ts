import mongoose from "mongoose";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { connectDB } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getStudentGuardians, upsertGuardians } from "@/lib/students";
import { Guardian, StudentGuardianLink } from "@/models/StudentRecords";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("students.view");
    if (error) return error;
    const { id } = await params;
    await connectDB();
    return successResponse({ guardians: await getStudentGuardians(id) });
  } catch (error) {
    return handleRouteError("Student guardians GET", error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("students.manage_guardians");
    if (error) return error;
    const { id } = await params;
    const body = await request.json();
    await connectDB();
    await upsertGuardians(id, Array.isArray(body.guardians) ? body.guardians : [body], user!._id);
    return successResponse({ guardians: await getStudentGuardians(id) }, 201);
  } catch (error) {
    return handleRouteError("Student guardians POST", error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("students.manage_guardians");
    if (error) return error;
    const { id } = await params;
    const guardianId = new URL(request.url).searchParams.get("guardianId");
    if (!guardianId || !mongoose.Types.ObjectId.isValid(guardianId)) return errorResponse("Invalid guardian id");
    await connectDB();
    const link = await StudentGuardianLink.findOneAndDelete({ studentId: id, guardianId });
    if (!link) return errorResponse("Guardian link not found", 404);
    await Guardian.updateOne({ _id: guardianId }, { $pull: { studentIds: new mongoose.Types.ObjectId(id) } });
    await recordAudit({
      userId: user!._id,
      action: "student.guardian.unlink",
      recordType: "student",
      recordId: id,
      metadata: { guardianId },
    });
    return successResponse({ guardians: await getStudentGuardians(id) });
  } catch (error) {
    return handleRouteError("Student guardians DELETE", error);
  }
}
