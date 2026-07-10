import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Course from "@/models/Course";
import Enrollment from "@/models/Enrollment";
import Payment from "@/models/Payment";
import { requirePermission, canModifyTargetUser } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { hashPassword } from "@/lib/auth";
import { formatStudent } from "@/lib/academic";
import {
  normalizeEnrollmentStatus,
  onEnrollmentCreated,
} from "@/lib/enrollment-service";
import type { StudentStatus, UserRole } from "@/types";

const ACTIVE_ENROLLMENT_STATUSES = ["pending", "approved", "accepted"] as never[];
const STUDENT_STATUSES: StudentStatus[] = ["active", "inactive", "pending"];

type StudentRecord = Parameters<typeof formatStudent>[0];

function normalizeStudentStatus(
  value: unknown,
  fallback: StudentStatus
): StudentStatus {
  return typeof value === "string" && STUDENT_STATUSES.includes(value as StudentStatus)
    ? (value as StudentStatus)
    : fallback;
}

function statusToIsActive(status: StudentStatus) {
  return status === "active";
}

async function enrichStudent(student: StudentRecord) {
  const studentId = student._id.toString();
  const objectId = new mongoose.Types.ObjectId(studentId);

  const [enrollments, payments] = await Promise.all([
    Enrollment.find({
      student: objectId,
      status: { $in: ACTIVE_ENROLLMENT_STATUSES },
    })
      .populate("course", "title price level")
      .sort({ createdAt: -1 })
      .lean(),
    Payment.aggregate([
      { $match: { studentId: objectId } },
      { $group: { _id: "$studentId", totalPaid: { $sum: "$amount" } } },
    ]),
  ]);

  const courses = enrollments
    .map((enrollment) => {
      const course = enrollment.course as {
        _id?: { toString(): string };
        title?: string;
        price?: number;
        level?: string;
      } | null;
      if (!course?._id) return null;
      return {
        _id: course._id.toString(),
        title: course.title ?? "",
        price: course.price ?? 0,
        level: course.level ?? "",
        enrollmentStatus: enrollment.status,
      };
    })
    .filter(Boolean);

  const totalAmount = courses.reduce((sum, course) => sum + (course?.price ?? 0), 0);
  const paidAmount = Number(payments[0]?.totalPaid) || 0;
  const paymentStatus =
    totalAmount > 0 && paidAmount >= totalAmount
      ? "paid"
      : paidAmount > 0
        ? "partial"
        : "unpaid";

  return {
    ...formatStudent(student),
    courses,
    course: courses[0] ?? null,
    totalAmount,
    paidAmount,
    balance: Math.max(0, totalAmount - paidAmount),
    paymentStatus,
  };
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

    return successResponse({ student: await enrichStudent(student as StudentRecord) });
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

    const target = await User.findById(id).select("+password");
    if (!target) return errorResponse("المستخدم غير موجود", 404);

    if (!canModifyTargetUser(user!.role, target.role as UserRole)) {
      return errorResponse("لا يمكنك تعديل هذا الحساب", 403);
    }
    if (target.role !== "student") {
      return errorResponse("الطالب غير موجود", 404);
    }

    if (body.phone?.trim()) {
      const duplicate = await User.findOne({
        _id: { $ne: id },
        phone: body.phone.trim(),
      });
      if (duplicate) return errorResponse("رقم الهاتف مسجل مسبقا", 409);
    }

    const currentStatus = normalizeStudentStatus(
      target.status,
      target.isActive ? "active" : "inactive"
    );
    const nextStatus = normalizeStudentStatus(
      body.status,
      body.isActive === false ? "inactive" : currentStatus
    );

    const updates: Record<string, unknown> = {
      status: nextStatus,
      isActive: statusToIsActive(nextStatus),
    };
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
          createdBy: user!._id,
        });
      }
    }

    const student = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      updates,
      { new: true }
    ).select("-password");

    if (!student) return errorResponse("الطالب غير موجود", 404);

    return successResponse({ student: await enrichStudent(student.toObject()) });
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
      { deletedAt: new Date(), isActive: false, status: "inactive" },
      { new: true }
    ).select("-password");

    return successResponse({
      message: "تم حذف الطالب",
      student: await enrichStudent(student!.toObject()),
    });
  } catch (err) {
    console.error("Admin student DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
