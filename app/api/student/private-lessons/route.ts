import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentPrivateLessons, StudentPortalError } from "@/lib/student-portal";

export async function GET() {
  try {
    return successResponse(await getStudentPrivateLessons());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الحصص الخاصة", error instanceof StudentPortalError ? error.status : 500);
  }
}
