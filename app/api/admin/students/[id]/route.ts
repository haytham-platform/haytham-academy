import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requirePermission, canModifyTargetUser } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { formatStudent } from "@/lib/academic";
import type { UserRole } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("students.view");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const student = await User.findOne({ _id: id, role: "student" })
      .select("-password")
      .lean();
    if (!student) return errorResponse("الطالب غير موجود", 404);

    return successResponse({ student: formatStudent(student) });
  } catch (err) {
    console.error("Admin student GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("students.manage");
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    await connectDB();

    const target = await User.findById(id).select("-password");
    if (!target) return errorResponse("المستخدم غير موجود", 404);

    if (!canModifyTargetUser(user!.role, target.role as UserRole)) {
      return errorResponse("لا يمكنك تعديل هذا الحساب", 403);
    }
    if (target.role !== "student") {
      return errorResponse("الطالب غير موجود", 404);
    }

    const updates: Record<string, unknown> = {};
    const fields = [
      "name",
      "phone",
      "gender",
      "guardianName",
      "guardianPhone",
      "address",
      "wilaya",
      "commune",
      "studyLevel",
      "institution",
      "notes",
      "isActive",
    ] as const;

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates[field] =
          typeof body[field] === "string" ? body[field].trim() : body[field];
      }
    }
    if (body.gender !== undefined && body.gender !== "male" && body.gender !== "female") {
      updates.gender = undefined;
    }
    if (body.dateOfBirth !== undefined) {
      updates.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    }

    const student = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      updates,
      { new: true }
    ).select("-password");

    if (!student) return errorResponse("الطالب غير موجود", 404);

    return successResponse({ student: formatStudent(student) });
  } catch (err) {
    return handleRouteError("Admin student PUT", err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("students.manage");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const target = await User.findById(id);
    if (!target || target.role !== "student") {
      return errorResponse("الطالب غير موجود", 404);
    }
    if (!canModifyTargetUser(user!.role, target.role as UserRole)) {
      return errorResponse("لا يمكنك حذف هذا الحساب", 403);
    }

    const student = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      { deletedAt: new Date(), isActive: false },
      { new: true }
    ).select("-password");

    return successResponse({
      message: "تم حذف الطالب (حذف منطقي)",
      student: formatStudent(student!),
    });
  } catch (err) {
    console.error("Admin student DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
