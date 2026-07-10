import { connectDB } from "@/lib/db";
import Course from "@/models/Course";
import Teacher from "@/models/Teacher";
import Enrollment from "@/models/Enrollment";
import type { CourseCardData, TeacherCardData } from "@/types/ui";

type StringableId = { toString(): string };

type PopulatedTeacher = {
  _id?: StringableId | string;
  name?: string;
  subject?: string;
} | null;

function idToString(value: StringableId | string | undefined | null): string {
  return value ? value.toString() : "";
}

function dateToIso(value: Date | string | undefined | null): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function teacherRefToPlain(teacher: PopulatedTeacher): CourseCardData["teacher"] {
  if (!teacher || typeof teacher !== "object") return null;
  return {
    _id: idToString(teacher._id),
    name: teacher.name ?? "",
    subject: teacher.subject ?? "",
  };
}

export async function getActiveCourses(limit?: number): Promise<CourseCardData[]> {
  await connectDB();
  let query = Course.find({ isActive: true })
    .populate("teacher", "name subject")
    .sort({ createdAt: -1 });

  if (limit) {
    query = query.limit(limit);
  }

  const courses = await query.lean();
  return courses.map((c) => ({
    _id: c._id.toString(),
    title: c.title,
    description: c.description,
    price: c.price,
    image: c.image,
    level: c.level,
    duration: c.duration,
    startDate: dateToIso(c.startDate),
    seats: c.seats,
    teacher: teacherRefToPlain(c.teacher as PopulatedTeacher),
  }));
}

export async function getActiveTeachers(limit?: number): Promise<TeacherCardData[]> {
  await connectDB();
  let query = Teacher.find({ isActive: true }).sort({ createdAt: -1 });

  if (limit) {
    query = query.limit(limit);
  }

  const teachers = await query.lean();
  return teachers.map((t) => ({
    _id: t._id.toString(),
    name: t.name,
    subject: t.subject,
    teachingLevel: t.teachingLevel,
  }));
}

export async function getStudentEnrollments(studentId: string) {
  await connectDB();
  const enrollments = await Enrollment.find({ student: studentId })
    .populate("course", "title level duration price")
    .sort({ createdAt: -1 })
    .lean();

  return enrollments.map((e) => ({
    _id: e._id.toString(),
    status: e.status,
    createdAt: dateToIso(e.createdAt),
    course: e.course as {
      title?: string;
      level?: string;
      duration?: string;
      price?: number;
    } | null,
  }));
}
