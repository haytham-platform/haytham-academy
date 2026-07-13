import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentFinance, StudentPortalError } from "@/lib/student-portal";

export async function GET() {
  try {
    return successResponse(await getStudentFinance());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل المالية", error instanceof StudentPortalError ? error.status : 500);
  }
}
