import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentDashboardData, StudentPortalError } from "@/lib/student-portal";

export async function GET() {
  try {
    return successResponse(await getStudentDashboardData());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل لوحة الطالب", error instanceof StudentPortalError ? error.status : 500);
  }
}
