import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentGrades, StudentPortalError } from "@/lib/student-portal";

export async function GET() {
  try {
    return successResponse(await getStudentGrades());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل العلامات", error instanceof StudentPortalError ? error.status : 500);
  }
}
