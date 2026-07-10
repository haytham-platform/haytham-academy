import { getActiveCourses, getActiveTeachers } from "@/lib/data";
import { mockCourses, mockTeachers } from "@/lib/mock-data";
import type { CourseCardData, TeacherCardData } from "@/types/ui";

export async function getCoursesForUI(limit?: number): Promise<CourseCardData[]> {
  try {
    const courses = await getActiveCourses(limit);
    if (courses.length > 0) return courses;
  } catch {
    /* fallback to mock */
  }
  const data: CourseCardData[] = mockCourses.map((c) => ({
    _id: c._id,
    title: c.title,
    description: c.description,
    price: c.price,
    image: c.image,
    level: c.level,
    duration: c.duration,
    startDate: c.startDate,
    seats: c.seats,
    teacher: {
      _id: c.teacher._id,
      name: c.teacher.name,
      subject: c.teacher.subject,
    },
  }));
  return limit ? data.slice(0, limit) : data;
}

export async function getTeachersForUI(limit?: number): Promise<TeacherCardData[]> {
  try {
    const teachers = await getActiveTeachers(limit);
    if (teachers.length > 0) return teachers;
  } catch {
    /* fallback to mock */
  }
  const data: TeacherCardData[] = mockTeachers.map((t) => ({
    _id: t._id,
    name: t.name,
    subject: t.subject,
    teachingLevel: t.teachingLevel,
  }));
  return limit ? data.slice(0, limit) : data;
}
