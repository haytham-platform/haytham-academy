import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentCourses, StudentPortalError } from "@/lib/student-portal";

export async function GET() {
  try {
    return successResponse(await getStudentCourses());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الدورات", error instanceof StudentPortalError ? error.status : 500);
  }
}
