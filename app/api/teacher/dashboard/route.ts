import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherDashboardData } from "@/lib/teacher-dashboard";

export async function GET() {
  try {
    return successResponse(await getTeacherDashboardData());
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل لوحة الأستاذ", 403);
  }
}
