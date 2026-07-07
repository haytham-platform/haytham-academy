import { getActiveCourses, getActiveTeachers } from "@/lib/data";
import { mockCourses, mockTeachers } from "@/lib/mock-data";

export async function getCoursesForUI(limit?: number) {
  try {
    const courses = await getActiveCourses(limit);
    if (courses.length > 0) return courses;
  } catch {
    /* fallback to mock */
  }
  const data = mockCourses.map((c) => ({
    _id: c._id,
    title: c.title,
    description: c.description,
    price: c.price,
    image: c.image,
    level: c.level,
    duration: c.duration,
    startDate: c.startDate,
    seats: c.seats,
    teacher: c.teacher,
  }));
  return limit ? data.slice(0, limit) : data;
}

export async function getTeachersForUI(limit?: number) {
  try {
    const teachers = await getActiveTeachers(limit);
    if (teachers.length > 0) return teachers;
  } catch {
    /* fallback to mock */
  }
  const data = mockTeachers.map((t) => ({
    _id: t._id,
    name: t.name,
    subject: t.subject,
    teachingLevel: t.teachingLevel,
  }));
  return limit ? data.slice(0, limit) : data;
}
