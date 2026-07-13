import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentAttendance, StudentPortalError } from "@/lib/student-portal";

export async function GET() {
  try {
    return successResponse(await getStudentAttendance());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الحضور", error instanceof StudentPortalError ? error.status : 500);
  }
}
