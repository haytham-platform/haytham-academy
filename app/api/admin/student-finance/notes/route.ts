import { StudentFinancialNote } from "@/models/StudentFinance";
import { requireStudentFinanceManage, requireStudentFinanceView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { createFinancialNote } from "@/lib/student-finance";

export async function GET(request: Request) {
  try {
    const { error } = await requireStudentFinanceView();
    if (error) return error;
    const studentId = new URL(request.url).searchParams.get("studentId");
    if (!studentId) return errorResponse("الطالب مطلوب");
    await connectDB();
    const notes = await StudentFinancialNote.find({ studentId }).sort({ createdAt: -1 }).lean();
    return successResponse({
      notes: notes.map((note) => ({
        _id: note._id.toString(),
        studentId: note.studentId.toString(),
        note: note.note,
        visibility: note.visibility,
        author: note.author.toString(),
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })),
    });
  } catch (err) {
    console.error("Student finance notes GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireStudentFinanceManage();
    if (error) return error;
    const note = await createFinancialNote(await request.json(), user!._id);
    return successResponse({ note }, 201);
  } catch (err) {
    console.error("Student finance note POST:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 400);
  }
}
