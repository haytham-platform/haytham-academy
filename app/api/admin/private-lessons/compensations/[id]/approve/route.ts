import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsCompensation } from "@/lib/auth-helpers";
import { approveTeacherLessonCompensation } from "@/lib/private-lessons";
import { arabicError } from "@/lib/arabic-errors";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePrivateLessonsCompensation();
    if (error) return error;
    const { id } = await params;
    const compensation = await approveTeacherLessonCompensation(id, user!._id);
    return successResponse({ compensation });
  } catch (err) {
    console.error("Private lesson compensation approve:", err);
    return errorResponse(arabicError(err), 400);
  }
}
