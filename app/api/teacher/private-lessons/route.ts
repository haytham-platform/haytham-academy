import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherPrivateLessons } from "@/lib/teacher-dashboard";

export async function GET() {
  try {
    return successResponse(await getTeacherPrivateLessons());
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل الحصص الخاصة", 403);
  }
}
