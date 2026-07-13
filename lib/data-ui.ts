import { getActiveCourses, getActiveTeachers } from "@/lib/data";
import type { CourseCardData, TeacherCardData } from "@/types/ui";

export async function getCoursesForUI(limit?: number): Promise<CourseCardData[]> {
  return getActiveCourses(limit);
}

export async function getTeachersForUI(limit?: number): Promise<TeacherCardData[]> {
  return getActiveTeachers(limit);
}
