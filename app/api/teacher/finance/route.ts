import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherFinance } from "@/lib/teacher-dashboard";

export async function GET() {
  try {
    return successResponse(await getTeacherFinance());
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل المالية", 403);
  }
}
