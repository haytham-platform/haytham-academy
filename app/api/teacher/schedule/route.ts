import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherSchedule } from "@/lib/teacher-dashboard";

export async function GET() {
  try {
    return successResponse(await getTeacherSchedule());
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل الجدول", 403);
  }
}
