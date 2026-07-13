import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherProfile } from "@/lib/teacher-dashboard";

export async function GET() {
  try {
    return successResponse(await getTeacherProfile());
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل الملف", 403);
  }
}
