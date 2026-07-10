import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import User from "@/models/User";
import Course from "@/models/Course";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { formatEnrollment } from "@/lib/academic";
import {
  normalizeEnrollmentStatus,
  onEnrollmentCreated,
} from "@/lib/enrollment-service";
import {
  buildPaginationMeta,
  parsePagination,
  parseSort,
} from "@/lib/pagination";

function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

async function buildEnrollmentFilter(searchParams: URLSearchParams) {
  const status = searchParams.get("status");
  const courseId = searchParams.get("courseId");
  const studentId = searchParams.get("studentId");
  const search = searchParams.get("search")?.trim();

  const filter: Record<string, unknown> = {};
  if (status) {
    const normalized = normalizeEnrollmentStatus(status);
    if (!normalized) {
      return { filter, error: errorResponse("حالة غير صالحة") };
    }
    filter.status =
      normalized === "approved"
        ? { $in: ["approved", "accepted"] }
        : normalized;
  }
  if (courseId) {
    if (!isValidObjectId(courseId)) {
      return { filter, error: errorResponse("الدورة غير صالحة") };
    }
    filter.course = courseId;
  }
  if (studentId) {
    if (!isValidObjectId(studentId)) {
      return { filter, error: errorResponse("الطالب غير صالح") };
    }
    filter.student = studentId;
  }

  if (search) {
    const [students, courses] = await Promise.all([
      User.find({
        role: "student",
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }).select("_id"),
      Course.find({
        deletedAt: null,
        title: { $regex: search, $options: "i" },
      }).select("_id"),
    ]);

    const searchOr: Record<string, unknown>[] = [];
    if (students.length) {
      searchOr.push({ student: { $in: students.map((s) => s._id) } });
    }
    if (courses.length) {
      searchOr.push({ course: { $in: courses.map((c) => c._id) } });
    }
    filter.$or = searchOr.length ? searchOr : [{ _id: null }];
  }

  return { filter, error: null };
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("enrollments.view");
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["createdAt", "updatedAt", "status"], "createdAt");

    await connectDB();

    const built = await buildEnrollmentFilter(searchParams);
    if (built.error) return built.error;

    const [enrollments, total] = await Promise.all([
      Enrollment.find(built.filter)
        .populate("student", "name phone")
        .populate({ path: "course", populate: { path: "teacher", select: "name" } })
        .populate("createdBy", "name role")
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Enrollment.countDocuments(built.filter),
    ]);

    return successResponse({
      enrollments: enrollments.map((e) => formatEnrollment(e)),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    return handleRouteError("Admin enrollments GET", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("enrollments.manage");
    if (error) return error;

    const body = await request.json();
    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
    const statusInput = normalizeEnrollmentStatus(body.status || "pending");

    if (!studentId) return errorResponse("الطالب مطلوب");
    if (!isValidObjectId(studentId)) return errorResponse("الطالب غير صالح");
    if (!courseId) return errorResponse("الدورة مطلوبة");
    if (!isValidObjectId(courseId)) return errorResponse("الدورة غير صالحة");
    if (!statusInput) return errorResponse("حالة غير صالحة");

    await connectDB();

    const [student, course, existing] = await Promise.all([
      User.findOne({
        _id: studentId,
        role: "student",
        deletedAt: null,
      }),
      Course.findOne({ _id: courseId, deletedAt: null, isActive: true }),
      Enrollment.findOne({ student: studentId, course: courseId }),
    ]);

    if (!student) return errorResponse("الطالب غير موجود", 404);
    if (!course) return errorResponse("الدورة غير موجودة", 404);
    if (existing) return errorResponse("الطالب مسجل مسبقا في هذه الدورة", 409);

    try {
      await onEnrollmentCreated(courseId, statusInput);
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "تعذر إنشاء التسجيل",
        400
      );
    }

    const enrollment = await Enrollment.create({
      student: studentId,
      course: courseId,
      status: statusInput,
      note: typeof body.note === "string" ? body.note.trim() : "",
      createdBy: user!._id,
    });

    const populated = await Enrollment.findById(enrollment._id)
      .populate("student", "name phone")
      .populate({ path: "course", populate: { path: "teacher", select: "name" } })
      .populate("createdBy", "name role")
      .lean();

    return successResponse({ enrollment: formatEnrollment(populated!) }, 201);
  } catch (err) {
    return handleRouteError("Admin enrollments POST", err);
  }
}
