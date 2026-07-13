import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherDocuments } from "@/lib/teacher-dashboard";

export async function GET() {
  try {
    return successResponse(await getTeacherDocuments());
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل الوثائق", 403);
  }
}
