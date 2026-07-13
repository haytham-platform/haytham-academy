import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentCommunications, StudentPortalError } from "@/lib/student-portal";

export async function GET() {
  try {
    return successResponse(await getStudentCommunications());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل التواصل", error instanceof StudentPortalError ? error.status : 500);
  }
}
