import { connectDB } from "@/lib/db";
import Course from "@/models/Course";
import Teacher from "@/models/Teacher";
import Enrollment from "@/models/Enrollment";

export async function getActiveCourses(limit?: number) {
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
    startDate: c.startDate,
    seats: c.seats,
    teacher: c.teacher as { name?: string; subject?: string } | null,
  }));
}

export async function getActiveTeachers(limit?: number) {
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
    createdAt: e.createdAt,
    course: e.course as {
      title?: string;
      level?: string;
      duration?: string;
      price?: number;
    } | null,
  }));
}
