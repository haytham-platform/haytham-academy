import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsManage, requirePrivateLessonsView } from "@/lib/auth-helpers";
import { addPrivateLessonNote } from "@/lib/private-lessons";
import { connectDB } from "@/lib/db";
import { PrivateLessonNote } from "@/models/PrivateLesson";
import { arabicError } from "@/lib/arabic-errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePrivateLessonsView();
    if (error) return error;
    const { id } = await params;
    await connectDB();
    const notes = await PrivateLessonNote.find({ lessonId: id }).sort({ createdAt: -1 }).lean();
    return successResponse({ notes: notes.map((note) => ({ _id: note._id.toString(), note: note.note, type: note.type, visibility: note.visibility, createdAt: note.createdAt })) });
  } catch (err) {
    console.error("Private lesson notes GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePrivateLessonsManage();
    if (error) return error;
    const { id } = await params;
    const note = await addPrivateLessonNote(id, await request.json(), user!._id);
    return successResponse({ note }, 201);
  } catch (err) {
    console.error("Private lesson notes POST:", err);
    return errorResponse(arabicError(err), 400);
  }
}
