import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherCommunications } from "@/lib/teacher-dashboard";

export async function GET() {
  try {
    return successResponse(await getTeacherCommunications());
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل التواصل", 403);
  }
}
