import { connectDB } from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import User from "@/models/User";
import Course from "@/models/Course";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
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

function buildEnrollmentFilter(searchParams: URLSearchParams) {
  const status = searchParams.get("status");
  const courseId = searchParams.get("courseId");
  const studentId = searchParams.get("studentId");
  const search = searchParams.get("search")?.trim();

  const filter: Record<string, unknown> = {};
  if (status) {
    const normalized = normalizeEnrollmentStatus(status);
    if (normalized) {
      filter.status =
        normalized === "approved"
          ? { $in: ["approved", "accepted"] }
          : normalized;
    }
  }
  if (courseId) filter.course = courseId;
  if (studentId) filter.student = studentId;

  return { filter, search };
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("enrollments.view");
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["createdAt", "status"], "createdAt");
    const { filter, search } = buildEnrollmentFilter(searchParams);

    await connectDB();

    if (search) {
      const students = await User.find({
        role: "student",
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      filter.student = { $in: students.map((s) => s._id) };
    }

    const [enrollments, total] = await Promise.all([
      Enrollment.find(filter)
        .populate("student", "name phone")
        .populate({ path: "course", populate: { path: "teacher", select: "name" } })
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Enrollment.countDocuments(filter),
    ]);

    return successResponse({
      enrollments: enrollments.map((e) => formatEnrollment(e)),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Admin enrollments GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("enrollments.manage");
    if (error) return error;

    const body = await request.json();
    const { studentId, courseId } = body;
    const statusInput = normalizeEnrollmentStatus(body.status || "pending");

    if (!studentId) return errorResponse("الطالب مطلوب");
    if (!courseId) return errorResponse("الدورة مطلوبة");
    if (!statusInput) return errorResponse("حالة غير صالحة");

    await connectDB();

    const student = await User.findOne({
      _id: studentId,
      role: "student",
      deletedAt: null,
    });
    if (!student) return errorResponse("الطالب غير موجود", 404);

    const course = await Course.findOne({ _id: courseId, deletedAt: null, isActive: true });
    if (!course) return errorResponse("الدورة غير موجودة", 404);

    const existing = await Enrollment.findOne({ student: studentId, course: courseId });
    if (existing) return errorResponse("الطالب مسجل مسبقاً في هذه الدورة", 409);

    await onEnrollmentCreated(courseId, statusInput);

    const enrollment = await Enrollment.create({
      student: studentId,
      course: courseId,
      status: statusInput,
      note: body.note?.trim() || "",
      createdBy: user!._id,
    });

    const populated = await Enrollment.findById(enrollment._id)
      .populate("student", "name phone")
      .populate({ path: "course", populate: { path: "teacher", select: "name" } })
      .lean();

    return successResponse({ enrollment: formatEnrollment(populated!) }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "حدث خطأ";
    console.error("Admin enrollments POST:", err);
    return errorResponse(message, 500);
  }
}
