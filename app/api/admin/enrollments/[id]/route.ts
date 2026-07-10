import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { formatEnrollment, formatEnrollmentStatus } from "@/lib/academic";
import {
  applyEnrollmentStatusChange,
  normalizeEnrollmentStatus,
  onEnrollmentRemoved,
} from "@/lib/enrollment-service";
import type { EnrollmentStatus } from "@/types";

function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

async function findPopulatedEnrollment(id: string) {
  return Enrollment.findById(id)
    .populate("student", "name phone guardianPhone studyLevel")
    .populate({ path: "course", populate: { path: "teacher", select: "name" } })
    .populate("createdBy", "name role")
    .lean();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("enrollments.view");
    if (error) return error;

    const { id } = await params;
    if (!isValidObjectId(id)) return errorResponse("التسجيل غير صالح");

    await connectDB();

    const enrollment = await findPopulatedEnrollment(id);
    if (!enrollment) return errorResponse("التسجيل غير موجود", 404);

    return successResponse({ enrollment: formatEnrollment(enrollment) });
  } catch (err) {
    return handleRouteError("Admin enrollment GET", err);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("enrollments.manage");
    if (error) return error;

    const { id } = await params;
    if (!isValidObjectId(id)) return errorResponse("التسجيل غير صالح");

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

    if (body.note !== undefined) {
      enrollment.note = typeof body.note === "string" ? body.note.trim() : "";
    }

    await enrollment.save({ validateModifiedOnly: true });

    const populated = await findPopulatedEnrollment(enrollment._id.toString());
    return successResponse({ enrollment: formatEnrollment(populated!) });
  } catch (err) {
    return handleRouteError("Admin enrollment PUT", err);
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
    if (!isValidObjectId(id)) return errorResponse("التسجيل غير صالح");

    await connectDB();

    const enrollment = await Enrollment.findById(id);
    if (!enrollment) return errorResponse("التسجيل غير موجود", 404);

    const status = formatEnrollmentStatus(enrollment.status) as EnrollmentStatus;
    await onEnrollmentRemoved(enrollment.course.toString(), status);
    await Enrollment.findByIdAndDelete(id);

    return successResponse({ message: "تم حذف التسجيل" });
  } catch (err) {
    return handleRouteError("Admin enrollment DELETE", err);
  }
}
