import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Course from "@/models/Course";
import Enrollment from "@/models/Enrollment";
import { requirePermission, canModifyTargetUser } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { recordAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import {
  normalizeEnrollmentStatus,
  onEnrollmentCreated,
} from "@/lib/enrollment-service";
import {
  STUDENT_STATUSES,
  enrichStudentRecord,
  listStudentRelatedRecords,
  studentUpdateFields,
  upsertGuardians,
} from "@/lib/students";
import type { EmergencyContact, StudentDocument, StudentStatus, UserRole } from "@/types";

type StudentRecord = Parameters<typeof enrichStudentRecord>[0];

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStudentStatus(value: unknown, fallback: StudentStatus): StudentStatus {
  return typeof value === "string" && STUDENT_STATUSES.includes(value as StudentStatus)
    ? (value as StudentStatus)
    : fallback;
}

function statusToIsActive(status: StudentStatus) {
  return status === "active" || status === "pending";
}

function sanitizeEmergencyContacts(value: unknown): EmergencyContact[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: trim((item as EmergencyContact).name),
      phone: trim((item as EmergencyContact).phone),
      relationship: trim((item as EmergencyContact).relationship),
    }))
    .filter((item) => item.name && item.phone)
    .slice(0, 5);
}

function sanitizeDocuments(value: unknown): StudentDocument[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      title: trim((item as StudentDocument).title),
      type: trim((item as StudentDocument).type) || "other",
      url: trim((item as StudentDocument).url),
      publicId: trim((item as StudentDocument).publicId) || undefined,
      uploadedAt: (item as StudentDocument).uploadedAt || new Date(),
    }))
    .filter((item) => item.title && item.url)
    .slice(0, 20);
}

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

    const [studentRecord, relatedRecords] = await Promise.all([
      enrichStudentRecord(student as StudentRecord),
      listStudentRelatedRecords(id),
    ]);
    return successResponse({ student: { ...studentRecord, ...relatedRecords } });
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
    const { user, error } = await requirePermission("students.update");
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    await connectDB();

    const target = await User.findById(id).select("+password");
    if (!target) return errorResponse("المستخدم غير موجود", 404);
    if (!canModifyTargetUser(user!.role, target.role as UserRole)) {
      return errorResponse("لا يمكنك تعديل هذا الحساب", 403);
    }
    if (target.role !== "student") return errorResponse("الطالب غير موجود", 404);

    if (!trim(body.name) && !trim(body.firstName)) return errorResponse("اسم الطالب مطلوب");
    if (!trim(body.phone)) return errorResponse("رقم الهاتف مطلوب");
    if (body.status && !STUDENT_STATUSES.includes(body.status as StudentStatus)) {
      return errorResponse("حالة الطالب غير صالحة");
    }

    const duplicate = await User.findOne({
      _id: { $ne: id },
      phone: trim(body.phone),
    });
    if (duplicate) return errorResponse("رقم الهاتف مسجل مسبقا", 409);

    const currentStatus = normalizeStudentStatus(
      target.status,
      target.isActive ? "active" : "suspended"
    );
    const nextStatus = normalizeStudentStatus(
      body.status,
      body.isActive === false ? "suspended" : currentStatus
    );

    const updates: Record<string, unknown> = {
      ...studentUpdateFields(body),
      status: nextStatus,
      isActive: statusToIsActive(nextStatus),
    };
    if (body.studentNumber !== undefined) updates.studentNumber = trim(body.studentNumber);
    const emergencyContacts = sanitizeEmergencyContacts(body.emergencyContacts);
    if (emergencyContacts !== undefined) updates.emergencyContacts = emergencyContacts;
    const documents = sanitizeDocuments(body.documents);
    if (documents !== undefined) updates.documents = documents;

    if (body.password?.trim()) {
      if (body.password.trim().length < 6) {
        return errorResponse("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      }
      updates.password = await hashPassword(body.password.trim());
    }

    if (body.courseId) {
      if (!mongoose.Types.ObjectId.isValid(body.courseId)) {
        return errorResponse("الدورة غير صالحة");
      }
      const course = await Course.findOne({
        _id: body.courseId,
        deletedAt: null,
        isActive: true,
      });
      if (!course) return errorResponse("الدورة غير موجودة", 404);

      const existingEnrollment = await Enrollment.findOne({
        student: id,
        course: body.courseId,
      });
      if (!existingEnrollment) {
        const enrollmentStatus = normalizeEnrollmentStatus(body.enrollmentStatus || "pending");
        if (!enrollmentStatus) return errorResponse("حالة التسجيل غير صالحة");
        await onEnrollmentCreated(body.courseId, enrollmentStatus);
        await Enrollment.create({
          student: id,
          course: body.courseId,
          status: enrollmentStatus,
          academicSeason: trim(body.academicSeason),
          academicLevel: trim(body.academicLevel) || trim(body.studyLevel),
          className: trim(body.className),
          enrollmentType: trim(body.enrollmentType),
          registrationFee: Number(body.registrationFee) || 0,
          tuitionFee: Number(body.tuitionFee) || 0,
          discount: Number(body.discount) || 0,
          finalPrice: Number(body.finalPrice) || 0,
          paymentPlan: trim(body.paymentPlan),
          startDate: body.enrollmentStartDate ? new Date(body.enrollmentStartDate) : undefined,
          endDate: body.enrollmentEndDate ? new Date(body.enrollmentEndDate) : undefined,
          createdBy: user!._id,
        });
      }
    }

    const guardianPayload = Array.isArray(body.guardians)
      ? body.guardians
      : body.guardianName || body.guardianPhone
        ? [
            {
              fullName: body.guardianName,
              primaryPhone: body.guardianPhone,
              relationship: body.guardianRelationship,
              isPrimary: true,
              financiallyResponsible: true,
              authorizedPickup: true,
            },
          ]
        : [];
    await upsertGuardians(id, guardianPayload, user!._id);

    const student = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      updates,
      { returnDocument: "after" }
    ).select("-password");

    if (!student) return errorResponse("الطالب غير موجود", 404);

    await recordAudit({
      userId: user!._id,
      action: "student.update",
      recordType: "student",
      recordId: id,
      metadata: { status: nextStatus, changedFields: Object.keys(updates) },
    });

    return successResponse({ student: await enrichStudentRecord(student.toObject()) });
  } catch (err) {
    return handleRouteError("Admin student PUT", err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("students.archive");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const target = await User.findById(id);
    if (!target || target.role !== "student") return errorResponse("الطالب غير موجود", 404);
    if (!canModifyTargetUser(user!.role, target.role as UserRole)) {
      return errorResponse("لا يمكنك حذف هذا الحساب", 403);
    }

    const student = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      { deletedAt: new Date(), isActive: false, status: "archived" },
      { returnDocument: "after" }
    ).select("-password");

    await recordAudit({
      userId: user!._id,
      action: "student.archive",
      recordType: "student",
      recordId: id,
    });

    return successResponse({
      message: "تم أرشفة الطالب",
      student: await enrichStudentRecord(student!.toObject()),
    });
  } catch (err) {
    console.error("Admin student DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
