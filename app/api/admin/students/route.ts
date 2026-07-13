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
import { recordAudit } from "@/lib/audit";
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
import {
  STUDENT_STATUSES,
  enrichStudentRecord,
  generateStudentNumber,
  studentUpdateFields,
  upsertGuardians,
} from "@/lib/students";
import type { EmergencyContact, StudentDocument, StudentStatus } from "@/types";

const ACTIVE_ENROLLMENT_STATUSES = ["pending", "approved", "accepted"] as never[];

type StudentRecord = Parameters<typeof formatStudent>[0];

interface StudentCourseSummary {
  _id: string;
  title: string;
  price: number;
  level: string;
  enrollmentStatus: string;
  enrolledAt?: Date;
  updatedAt?: Date;
}

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStudentStatus(value: unknown, fallback: StudentStatus): StudentStatus {
  return typeof value === "string" && STUDENT_STATUSES.includes(value as StudentStatus)
    ? (value as StudentStatus)
    : fallback;
}

function sanitizeEmergencyContacts(value: unknown): EmergencyContact[] {
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

function sanitizeDocuments(value: unknown): StudentDocument[] {
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

function validateStudentPayload(body: Record<string, unknown>, isCreate: boolean) {
  const validationErrors: { field: string; message: string }[] = [];
  if (!trim(body.name) && !trim(body.firstName)) validationErrors.push({ field: "name", message: "اسم الطالب مطلوب" });
  if (!trim(body.phone)) validationErrors.push({ field: "phone", message: "رقم الهاتف مطلوب" });
  if (isCreate && !trim(body.password)) {
    validationErrors.push({ field: "password", message: "كلمة المرور مطلوبة" });
  }
  if (trim(body.password) && trim(body.password).length < 6) {
    validationErrors.push({
      field: "password",
      message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
    });
  }
  if (body.status && !STUDENT_STATUSES.includes(body.status as StudentStatus)) {
    validationErrors.push({ field: "status", message: "حالة الطالب غير صالحة" });
  }
  if (
    Array.isArray(body.emergencyContacts) &&
    body.emergencyContacts.length !== sanitizeEmergencyContacts(body.emergencyContacts).length
  ) {
    validationErrors.push({
      field: "emergencyContacts",
      message: "كل جهة طوارئ يجب أن تحتوي على الاسم والهاتف",
    });
  }
  if (Array.isArray(body.documents) && body.documents.length !== sanitizeDocuments(body.documents).length) {
    validationErrors.push({
      field: "documents",
      message: "كل وثيقة يجب أن تحتوي على العنوان والرابط",
    });
  }
  return validationErrors;
}

function validationResponse(validationErrors: { field: string; message: string }[]) {
  return Response.json(
    { error: "بيانات الطالب غير مكتملة", validationErrors },
    { status: 400 }
  );
}

function buildStudentFilter(searchParams: URLSearchParams) {
  const search = searchParams.get("search")?.trim();
  const studentNumber = searchParams.get("studentNumber")?.trim();
  const gender = searchParams.get("gender");
  const wilaya = searchParams.get("wilaya")?.trim();
  const municipality = searchParams.get("municipality")?.trim();
  const studyLevel = searchParams.get("studyLevel")?.trim();
  const academicLevel = searchParams.get("academicLevel")?.trim();
  const academicSeason = searchParams.get("academicSeason")?.trim();
  const className = searchParams.get("className")?.trim();
  const enrollmentType = searchParams.get("enrollmentType")?.trim();
  const status = searchParams.get("status");
  const isActive = searchParams.get("isActive");
  const registrationFrom = searchParams.get("registrationFrom");
  const registrationTo = searchParams.get("registrationTo");
  const deletedOnly = searchParams.get("deletedOnly") === "true";
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  const filter: Record<string, unknown> = {
    role: "student",
    ...(deletedOnly ? { deletedAt: { $ne: null } } : notDeletedFilter(includeDeleted)),
  };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { studentNumber: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { secondaryPhone: { $regex: search, $options: "i" } },
      { guardianName: { $regex: search, $options: "i" } },
      { guardianPhone: { $regex: search, $options: "i" } },
      { academicLevel: { $regex: search, $options: "i" } },
      { className: { $regex: search, $options: "i" } },
      { studyLevel: { $regex: search, $options: "i" } },
      { institution: { $regex: search, $options: "i" } },
    ];
  }
  if (studentNumber) filter.studentNumber = { $regex: studentNumber, $options: "i" };
  if (gender === "male" || gender === "female") filter.gender = gender;
  if (wilaya) filter.wilaya = { $regex: wilaya, $options: "i" };
  if (municipality) filter.municipality = { $regex: municipality, $options: "i" };
  if (studyLevel) filter.studyLevel = { $regex: studyLevel, $options: "i" };
  if (academicLevel) filter.academicLevel = { $regex: academicLevel, $options: "i" };
  if (academicSeason) filter.academicSeason = { $regex: academicSeason, $options: "i" };
  if (className) filter.className = { $regex: className, $options: "i" };
  if (enrollmentType) filter.enrollmentType = enrollmentType;
  if (status && STUDENT_STATUSES.includes(status as StudentStatus)) filter.status = status;
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;
  if (registrationFrom || registrationTo) {
    const range: Record<string, Date> = {};
    if (registrationFrom) {
      const from = new Date(registrationFrom);
      if (!Number.isNaN(from.getTime())) range.$gte = from;
    }
    if (registrationTo) {
      const to = new Date(registrationTo);
      if (!Number.isNaN(to.getTime())) range.$lte = to;
    }
    if (Object.keys(range).length) filter.registrationDate = range;
  }

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
    Enrollment.find({ student: { $in: objectIds } })
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
      enrolledAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    });
    coursesByStudent.set(studentId, courses);
    if (ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status as never)) {
      totalsByStudent.set(studentId, (totalsByStudent.get(studentId) ?? 0) + (course.price ?? 0));
    }
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
      enrollmentHistory: courses,
      course: courses.find((course) =>
        ACTIVE_ENROLLMENT_STATUSES.includes(course.enrollmentStatus as never)
      ) ?? courses[0] ?? null,
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
    const sort = parseSort(
      searchParams,
      ["name", "studentNumber", "registrationDate", "createdAt", "wilaya", "academicLevel", "className", "status"],
      "createdAt"
    );
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
    const { user, error } = await requirePermission("students.create");
    if (error) return error;

    const body = await request.json();
    const validationErrors = validateStudentPayload(body, true);
    if (validationErrors.length) return validationResponse(validationErrors);

    const status = normalizeStudentStatus(
      body.status,
      body.isActive === false ? "suspended" : "active"
    );

    await connectDB();

    const exists = await User.findOne({ phone: trim(body.phone) });
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

    const baseStudentFields = studentUpdateFields(body);
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

    const student = await User.create({
      ...baseStudentFields,
      studentNumber: trim(body.studentNumber) || await generateStudentNumber(),
      password: await hashPassword(trim(body.password)),
      role: "student",
      emergencyContacts: sanitizeEmergencyContacts(body.emergencyContacts),
      documents: sanitizeDocuments(body.documents),
    });

    await upsertGuardians(student._id.toString(), guardianPayload, user!._id);

    if (body.courseId) {
      const enrollmentStatus = normalizeEnrollmentStatus(body.enrollmentStatus || "pending");
      if (!enrollmentStatus) return errorResponse("حالة التسجيل غير صالحة");

      await onEnrollmentCreated(body.courseId, enrollmentStatus);
      await Enrollment.create({
        student: student._id,
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

    await recordAudit({
      userId: user!._id,
      action: "student.create",
      recordType: "student",
      recordId: student._id.toString(),
      metadata: { status, courseId: body.courseId || null },
    });

    return successResponse({ student: await enrichStudentRecord(student.toObject()) }, 201);
  } catch (err) {
    return handleRouteError("Admin students POST", err);
  }
}
