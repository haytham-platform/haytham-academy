import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentSchedule, StudentPortalError } from "@/lib/student-portal";

export async function GET() {
  try {
    return successResponse(await getStudentSchedule());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الجدول", error instanceof StudentPortalError ? error.status : 500);
  }
}
