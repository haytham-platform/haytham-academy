import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentDocuments, StudentPortalError } from "@/lib/student-portal";

export async function GET() {
  try {
    return successResponse(await getStudentDocuments());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الوثائق", error instanceof StudentPortalError ? error.status : 500);
  }
}
