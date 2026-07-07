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

  const students = rows.map((s) => formatStudent(s));

  if (exportCsv) {
    const csv = toCsv(
      ["الاسم", "الهاتف", "الولاية", "المستوى", "الحالة", "تاريخ الإنشاء"],
      students.map((s) => [
        s.name,
        s.phone ?? "",
        s.wilaya ?? "",
        s.studyLevel ?? "",
        s.isActive ? "نشط" : "موقوف",
        new Date(s.createdAt).toLocaleDateString("ar-DZ"),
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
  const filter: Record<string, unknown> = { deletedAt: null };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
    ];
  }

  const sort = parseSort(searchParams, ["name", "createdAt", "subject"], "createdAt");
  const [rows, total] = await Promise.all([
    Teacher.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
    Teacher.countDocuments(filter),
  ]);

  const teachers = rows.map((t) => formatTeacher(t));

  if (exportCsv) {
    const csv = toCsv(
      ["الاسم", "المادة", "الهاتف", "السنة/المستوى", "نسبة الإدارة", "نسبة الأستاذ", "الحالة"],
      teachers.map((t) => [
        t.name,
        t.subject,
        t.phone,
        t.teachingLevel,
        t.adminShare !== undefined ? `${t.adminShare}%` : "",
        t.teacherShare !== undefined ? `${t.teacherShare}%` : "",
        t.isActive ? "نشط" : "موقوف",
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

  const courses = rows.map((c) => formatCourse(c));

  if (exportCsv) {
    const csv = toCsv(
      ["الدورة", "الأستاذ", "القسم", "السعر", "المقاعد", "المتبقي", "الحالة"],
      courses.map((c) => [
        c.title,
        (c.teacher as { name?: string })?.name ?? "",
        c.department,
        String(c.price),
        String(c.seats),
        String(c.remainingSeats),
        c.isActive ? "نشطة" : "موقوفة",
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

  const enrollments = rows.map((e) => formatEnrollment(e));

  if (exportCsv) {
    const csv = toCsv(
      ["الطالب", "الهاتف", "الدورة", "الحالة", "التاريخ"],
      enrollments.map((e) => [
        (e.student as { name?: string })?.name ?? "",
        (e.student as { phone?: string })?.phone ?? "",
        (e.course as { title?: string })?.title ?? "",
        e.status,
        new Date(e.createdAt).toLocaleDateString("ar-DZ"),
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
