import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsAttendance } from "@/lib/auth-helpers";
import { recordPrivateLessonAttendance } from "@/lib/private-lessons";
import { arabicError } from "@/lib/arabic-errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePrivateLessonsAttendance();
    if (error) return error;
    const { id } = await params;
    const lesson = await recordPrivateLessonAttendance(id, await request.json(), user!._id);
    return successResponse({ lesson });
  } catch (err) {
    console.error("Private lesson attendance:", err);
    return errorResponse(arabicError(err), 400);
  }
}
