import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Course from "@/models/Course";
import Enrollment from "@/models/Enrollment";
import Payment from "@/models/Payment";
import { hashPassword } from "@/lib/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { formatStudent, notDeletedFilter } from "@/lib/academic";
import {
  normalizeEnrollmentStatus,
  onEnrollmentCreated,
} from "@/lib/enrollment-service";
import {
  buildPaginationMeta,
  parsePagination,
  parseSort,
} from "@/lib/pagination";
import type { StudentStatus } from "@/types";

const ACTIVE_ENROLLMENT_STATUSES = ["pending", "approved", "accepted"] as never[];
const STUDENT_STATUSES: StudentStatus[] = ["active", "inactive", "pending"];

type StudentRecord = Parameters<typeof formatStudent>[0];
interface StudentCourseSummary {
  _id: string;
  title: string;
  price: number;
  level: string;
  enrollmentStatus: string;
}

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

function buildStudentFilter(searchParams: URLSearchParams) {
  const search = searchParams.get("search")?.trim();
  const gender = searchParams.get("gender");
  const wilaya = searchParams.get("wilaya")?.trim();
  const studyLevel = searchParams.get("studyLevel")?.trim();
  const status = searchParams.get("status");
  const isActive = searchParams.get("isActive");
  const deletedOnly = searchParams.get("deletedOnly") === "true";
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  const filter: Record<string, unknown> = {
    role: "student",
    ...(deletedOnly ? { deletedAt: { $ne: null } } : notDeletedFilter(includeDeleted)),
  };
  const andFilters: object[] = [];

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { guardianPhone: { $regex: search, $options: "i" } },
    ];
  }
  if (gender === "male" || gender === "female") filter.gender = gender;
  if (wilaya) filter.wilaya = { $regex: wilaya, $options: "i" };
  if (studyLevel) filter.studyLevel = { $regex: studyLevel, $options: "i" };
  if (status === "pending") filter.status = "pending";
  if (status === "active") {
    andFilters.push({
      $or: [{ status: "active" }, { status: { $exists: false }, isActive: true }],
    });
  }
  if (status === "inactive") {
    andFilters.push({
      $or: [{ status: "inactive" }, { isActive: false }],
    });
  }
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;
  if (andFilters.length > 0) filter.$and = andFilters;

  return filter;
}

async function studentIdsForCourseFilter(searchParams: URLSearchParams) {
  const courseId = searchParams.get("courseId");
  const search = searchParams.get("search")?.trim();
  const courseFilter: Record<string, unknown> = { deletedAt: null };

  if (courseId) {
    if (!mongoose.Types.ObjectId.isValid(courseId)) return [];
    courseFilter._id = courseId;
  } else if (search) {
    courseFilter.$or = [
      { title: { $regex: search, $options: "i" } },
      { level: { $regex: search, $options: "i" } },
    ];
  } else {
    return null;
  }

  const courses = await Course.find(courseFilter).select("_id").lean();
  if (courses.length === 0) return [];

  const enrollments = await Enrollment.find({
    course: { $in: courses.map((course) => course._id) },
    status: { $in: ACTIVE_ENROLLMENT_STATUSES },
  })
    .select("student")
    .lean();

  return [...new Set(enrollments.map((enrollment) => enrollment.student.toString()))];
}

async function enrichStudents(students: StudentRecord[]) {
  const studentIds = students.map((student) => student._id.toString());
  const objectIds = studentIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const [enrollments, payments] = await Promise.all([
    Enrollment.find({
      student: { $in: objectIds },
      status: { $in: ACTIVE_ENROLLMENT_STATUSES },
    })
      .populate("course", "title price level")
      .sort({ createdAt: -1 })
      .lean(),
    Payment.aggregate([
      { $match: { studentId: { $in: objectIds } } },
      { $group: { _id: "$studentId", totalPaid: { $sum: "$amount" } } },
    ]),
  ]);

  const coursesByStudent = new Map<string, StudentCourseSummary[]>();
  const totalsByStudent = new Map<string, number>();
  for (const enrollment of enrollments) {
    const studentId = enrollment.student.toString();
    const course = enrollment.course as {
      _id?: { toString(): string };
      title?: string;
      price?: number;
      level?: string;
    } | null;
    if (!course?._id) continue;

    const courses = coursesByStudent.get(studentId) ?? [];
    courses.push({
      _id: course._id.toString(),
      title: course.title ?? "",
      price: course.price ?? 0,
      level: course.level ?? "",
      enrollmentStatus: enrollment.status,
    });
    coursesByStudent.set(studentId, courses);
    totalsByStudent.set(studentId, (totalsByStudent.get(studentId) ?? 0) + (course.price ?? 0));
  }

  const paidByStudent = new Map(
    payments.map((payment) => [payment._id.toString(), Number(payment.totalPaid) || 0])
  );

  return students.map((student) => {
    const studentId = student._id.toString();
    const courses = coursesByStudent.get(studentId) ?? [];
    const totalAmount = totalsByStudent.get(studentId) ?? 0;
    const paidAmount = paidByStudent.get(studentId) ?? 0;
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
  });
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("students.view");
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["name", "createdAt", "wilaya"], "createdAt");
    const filter = buildStudentFilter(searchParams);
    const paymentStatus = searchParams.get("paymentStatus");

    await connectDB();

    const courseStudentIds = await studentIdsForCourseFilter(searchParams);
    if (courseStudentIds) {
      const existingAnd = (filter.$and as object[] | undefined) ?? [];
      filter.$and = [
        ...existingAnd,
        { _id: { $in: courseStudentIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      ];
    }

    const matchingStudents = await User.find(filter)
      .select("-password")
      .sort(sort)
      .lean();

    let enrichedStudents = await enrichStudents(matchingStudents as StudentRecord[]);
    if (["paid", "partial", "unpaid"].includes(paymentStatus ?? "")) {
      enrichedStudents = enrichedStudents.filter(
        (student) => student.paymentStatus === paymentStatus
      );
    }

    const total = enrichedStudents.length;
    const students = enrichedStudents.slice(
      pagination.skip,
      pagination.skip + pagination.limit
    );

    return successResponse({
      students,
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Admin students GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requirePermission("students.manage");
    if (error) return error;

    const body = await request.json();
    if (!body.name?.trim()) return errorResponse("الاسم مطلوب");
    if (!body.phone?.trim()) return errorResponse("رقم الهاتف مطلوب");

    const password = body.password?.trim() || "Student123";
    const status = normalizeStudentStatus(
      body.status,
      body.isActive === false ? "inactive" : "active"
    );
    if (password.length < 6) {
      return errorResponse("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    }

    await connectDB();

    const exists = await User.findOne({ phone: body.phone.trim() });
    if (exists) return errorResponse("رقم الهاتف مسجل مسبقا", 409);

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
    }

    const student = await User.create({
      name: body.name.trim(),
      phone: body.phone.trim(),
      password: await hashPassword(password),
      role: "student",
      status,
      isActive: statusToIsActive(status),
      gender: body.gender === "male" || body.gender === "female" ? body.gender : undefined,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      guardianName: body.guardianName?.trim(),
      guardianPhone: body.guardianPhone?.trim(),
      address: body.address?.trim(),
      wilaya: body.wilaya?.trim(),
      commune: body.commune?.trim(),
      studyLevel: body.studyLevel?.trim(),
      institution: body.institution?.trim(),
      notes: body.notes?.trim() || "",
    });

    if (body.courseId) {
      const enrollmentStatus = normalizeEnrollmentStatus(body.enrollmentStatus || "pending");
      if (!enrollmentStatus) return errorResponse("حالة التسجيل غير صالحة");

      await onEnrollmentCreated(body.courseId, enrollmentStatus);
      await Enrollment.create({
        student: student._id,
        course: body.courseId,
        status: enrollmentStatus,
      });
    }

    const [enrichedStudent] = await enrichStudents([student.toObject()]);
    return successResponse({ student: enrichedStudent }, 201);
  } catch (err) {
    return handleRouteError("Admin students POST", err);
  }
}
