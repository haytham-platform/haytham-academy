import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsView } from "@/lib/auth-helpers";
import { getPrivateLessonStats } from "@/lib/private-lessons";

export async function GET() {
  try {
    const { error } = await requirePrivateLessonsView();
    if (error) return error;
    const stats = await getPrivateLessonStats();
    return successResponse({ stats });
  } catch (err) {
    console.error("Private lesson stats GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
