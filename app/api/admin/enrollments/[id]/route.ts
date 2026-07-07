import { connectDB } from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatEnrollment, formatEnrollmentStatus } from "@/lib/academic";
import {
  applyEnrollmentStatusChange,
  normalizeEnrollmentStatus,
  onEnrollmentRemoved,
} from "@/lib/enrollment-service";
import type { EnrollmentStatus } from "@/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("enrollments.manage");
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    await connectDB();

    const enrollment = await Enrollment.findById(id);
    if (!enrollment) return errorResponse("التسجيل غير موجود", 404);

    const previousStatus = formatEnrollmentStatus(enrollment.status);

    if (body.status !== undefined) {
      const nextStatus = normalizeEnrollmentStatus(body.status);
      if (!nextStatus) return errorResponse("حالة غير صالحة");

      try {
        await applyEnrollmentStatusChange(
          enrollment.course.toString(),
          previousStatus,
          nextStatus
        );
      } catch (err) {
        return errorResponse(
          err instanceof Error ? err.message : "تعذر تحديث الحالة",
          400
        );
      }

      enrollment.set("status", nextStatus);
    }

    if (body.note !== undefined) enrollment.note = body.note?.trim() || "";
    await enrollment.save({ validateModifiedOnly: true });

    const populated = await Enrollment.findById(enrollment._id)
      .populate("student", "name phone")
      .populate({ path: "course", populate: { path: "teacher", select: "name" } })
      .lean();

    return successResponse({ enrollment: formatEnrollment(populated!) });
  } catch (err) {
    console.error("Admin enrollment PUT:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("enrollments.manage");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const enrollment = await Enrollment.findById(id);
    if (!enrollment) return errorResponse("التسجيل غير موجود", 404);

    const status = formatEnrollmentStatus(enrollment.status) as EnrollmentStatus;
    await onEnrollmentRemoved(enrollment.course.toString(), status);
    await Enrollment.findByIdAndDelete(id);

    return successResponse({ message: "تم حذف التسجيل" });
  } catch (err) {
    console.error("Admin enrollment DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
