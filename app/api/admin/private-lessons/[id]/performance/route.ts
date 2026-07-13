import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsAttendance, requirePrivateLessonsView } from "@/lib/auth-helpers";
import { upsertPrivateLessonPerformance } from "@/lib/private-lessons";
import { connectDB } from "@/lib/db";
import { PrivateLessonPerformance } from "@/models/PrivateLesson";
import { arabicError } from "@/lib/arabic-errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePrivateLessonsView();
    if (error) return error;
    const { id } = await params;
    await connectDB();
    const records = await PrivateLessonPerformance.find({ lessonId: id }).sort({ createdAt: -1 }).lean();
    return successResponse({ records });
  } catch (err) {
    console.error("Private lesson performance GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePrivateLessonsAttendance();
    if (error) return error;
    const { id } = await params;
    const record = await upsertPrivateLessonPerformance(id, await request.json(), user!._id);
    return successResponse({ record }, 201);
  } catch (err) {
    console.error("Private lesson performance POST:", err);
    return errorResponse(arabicError(err), 400);
  }
}
