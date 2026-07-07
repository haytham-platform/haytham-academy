import { connectDB } from "@/lib/db";
import Teacher from "@/models/Teacher";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatTeacher } from "@/lib/academic";

function parseAdminShare(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("teachers.manage");
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    await connectDB();

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.subject !== undefined) updates.subject = body.subject.trim();
    if (body.phone !== undefined) updates.phone = body.phone.trim();
    if (body.teachingLevel !== undefined) updates.teachingLevel = body.teachingLevel.trim();
    if (body.adminShare !== undefined) {
      const adminShare = parseAdminShare(body.adminShare);
      if (adminShare === null) {
        return errorResponse("نسبة الإدارة يجب أن تكون بين 0 و 100");
      }
      updates.adminShare = adminShare;
    }
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    const teacher = await Teacher.findOneAndUpdate(
      { _id: id, deletedAt: null },
      updates,
      { new: true }
    );

    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    return successResponse({ teacher: formatTeacher(teacher) });
  } catch (err) {
    console.error("Admin teacher PUT:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("teachers.manage");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const teacher = await Teacher.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { deletedAt: new Date(), isActive: false },
      { new: true }
    );

    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    return successResponse({
      message: "تم حذف الأستاذ (حذف منطقي)",
      teacher: formatTeacher(teacher),
    });
  } catch (err) {
    console.error("Admin teacher DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
