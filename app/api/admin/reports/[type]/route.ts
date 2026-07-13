import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Course from "@/models/Course";
import Enrollment from "@/models/Enrollment";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse } from "@/lib/api-response";
import {
  formatCourse,
  formatEnrollment,
  formatStudent,
  formatTeacher,
  toCsv,
  csvResponse,
} from "@/lib/academic";
import {
  buildPaginationMeta,
  parsePagination,
  parseSort,
} from "@/lib/pagination";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { error } = await requirePermission("reports.view");
    if (error) return error;

    const { type } = await params;
    if (!["students", "teachers", "courses", "enrollments"].includes(type)) {
      return errorResponse("نوع التقرير غير صالح", 404);
    }

    const { searchParams } = new URL(request.url);
    const exportCsv = searchParams.get("export") === "csv";
    const pagination = parsePagination(searchParams, exportCsv ? 1000 : 10);

    await connectDB();

    if (type === "students") return reportStudents(searchParams, pagination, exportCsv);
    if (type === "teachers") return reportTeachers(searchParams, pagination, exportCsv);
    if (type === "courses") return reportCourses(searchParams, pagination, exportCsv);
    return reportEnrollments(searchParams, pagination, exportCsv);
  } catch (err) {
    console.error("Admin reports GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

async function reportStudents(
  searchParams: URLSearchParams,
  pagination: ReturnType<typeof parsePagination>,
  exportCsv: boolean
) {
  const search = searchParams.get("search")?.trim();
  const filter: Record<string, unknown> = { role: "student", deletedAt: null };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { guardianName: { $regex: search, $options: "i" } },
      { guardianPhone: { $regex: search, $options: "i" } },
    ];
  }

  const sort = parseSort(searchParams, ["name", "createdAt", "wilaya"], "createdAt");
  const [rows, total] = await Promise.all([
    User.find(filter)
      .select("-password")
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const students = rows.map((student) => formatStudent(student));

  if (exportCsv) {
    const csv = toCsv(
      ["الاسم", "الهاتف", "الولاية", "المستوى الأكاديمي", "القسم", "الحالة", "تاريخ الإنشاء"],
      students.map((student) => [
        student.name,
        student.phone ?? "",
        student.wilaya ?? "",
        student.academicLevel ?? student.studyLevel ?? "",
        student.className ?? "",
        student.status ?? (student.isActive ? "active" : "suspended"),
        new Date(student.createdAt).toLocaleDateString("ar-DZ"),
      ])
    );
    return csvResponse("students-report.csv", csv);
  }

  return Response.json({
    success: true,
    students,
    pagination: buildPaginationMeta(total, pagination),
  });
}

async function reportTeachers(
  searchParams: URLSearchParams,
  pagination: ReturnType<typeof parsePagination>,
  exportCsv: boolean
) {
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status")?.trim();
  const employmentType = searchParams.get("employmentType")?.trim();
  const filter: Record<string, unknown> = { deletedAt: null };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
      { subjects: { $regex: search, $options: "i" } },
      { academicLevels: { $regex: search, $options: "i" } },
      { assignedClasses: { $regex: search, $options: "i" } },
    ];
  }
  if (status) filter.status = status;
  if (employmentType) filter.employmentType = employmentType;

  const sort = parseSort(searchParams, ["name", "createdAt", "subject", "status", "employmentType"], "createdAt");
  const [rows, total] = await Promise.all([
    Teacher.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
    Teacher.countDocuments(filter),
  ]);

  const teachers = rows.map((teacher) => formatTeacher(teacher));

  if (exportCsv) {
    const csv = toCsv(
      ["الاسم", "المواد", "الهاتف", "المستويات", "الأقسام", "نوع التوظيف", "نوع الراتب", "نسبة الإدارة", "نسبة الأستاذ", "الحالة"],
      teachers.map((teacher) => [
        teacher.name,
        teacher.subjects.join("، "),
        teacher.phone,
        teacher.academicLevels.join("، "),
        teacher.assignedClasses.join("، "),
        teacher.employmentType,
        teacher.salaryConfig?.type ?? "",
        teacher.adminShare !== undefined ? `${teacher.adminShare}%` : "",
        teacher.teacherShare !== undefined ? `${teacher.teacherShare}%` : "",
        teacher.status,
      ])
    );
    return csvResponse("teachers-report.csv", csv);
  }

  return Response.json({
    success: true,
    teachers,
    pagination: buildPaginationMeta(total, pagination),
  });
}

async function reportCourses(
  searchParams: URLSearchParams,
  pagination: ReturnType<typeof parsePagination>,
  exportCsv: boolean
) {
  const search = searchParams.get("search")?.trim();
  const filter: Record<string, unknown> = { deletedAt: null };
  if (search) {
    filter.title = { $regex: search, $options: "i" };
  }

  const sort = parseSort(searchParams, ["title", "createdAt", "price"], "createdAt");
  const [rows, total] = await Promise.all([
    Course.find(filter)
      .populate("teacher", "name")
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Course.countDocuments(filter),
  ]);

  const courses = rows.map((course) => formatCourse(course));

  if (exportCsv) {
    const csv = toCsv(
      ["الدورة", "الأستاذ", "القسم", "السعر", "المقاعد", "المتبقي", "الحالة"],
      courses.map((course) => [
        course.title,
        (course.teacher as { name?: string })?.name ?? "",
        course.department,
        String(course.price),
        String(course.seats),
        String(course.remainingSeats),
        course.isActive ? "نشطة" : "موقوفة",
      ])
    );
    return csvResponse("courses-report.csv", csv);
  }

  return Response.json({
    success: true,
    courses,
    pagination: buildPaginationMeta(total, pagination),
  });
}

async function reportEnrollments(
  searchParams: URLSearchParams,
  pagination: ReturnType<typeof parsePagination>,
  exportCsv: boolean
) {
  const status = searchParams.get("status");
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status === "approved" ? { $in: ["approved", "accepted"] } : status;

  const sort = parseSort(searchParams, ["createdAt", "status"], "createdAt");
  const [rows, total] = await Promise.all([
    Enrollment.find(filter)
      .populate("student", "name phone")
      .populate("course", "title")
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Enrollment.countDocuments(filter),
  ]);

  const enrollments = rows.map((enrollment) => formatEnrollment(enrollment));

  if (exportCsv) {
    const csv = toCsv(
      ["الطالب", "الهاتف", "الدورة", "الحالة", "التاريخ"],
      enrollments.map((enrollment) => [
        (enrollment.student as { name?: string })?.name ?? "",
        (enrollment.student as { phone?: string })?.phone ?? "",
        (enrollment.course as { title?: string })?.title ?? "",
        enrollment.status,
        new Date(enrollment.createdAt).toLocaleDateString("ar-DZ"),
      ])
    );
    return csvResponse("enrollments-report.csv", csv);
  }

  return Response.json({
    success: true,
    enrollments,
    pagination: buildPaginationMeta(total, pagination),
  });
}
