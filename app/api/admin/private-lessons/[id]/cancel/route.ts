import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsManage } from "@/lib/auth-helpers";
import { cancelPrivateLesson } from "@/lib/private-lessons";
import { arabicError } from "@/lib/arabic-errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePrivateLessonsManage();
    if (error) return error;
    const { id } = await params;
    const lesson = await cancelPrivateLesson(id, await request.json(), user!._id);
    return successResponse({ lesson });
  } catch (err) {
    console.error("Private lesson cancel:", err);
    return errorResponse(arabicError(err), 400);
  }
}
