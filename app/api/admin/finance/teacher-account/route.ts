import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import Teacher from "@/models/Teacher";
import { requireFinancePayout } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  computeTeacherAccount,
  formatLessonInvoice,
  getInvoicesForTeacherAccount,
  normalizeId,
} from "@/lib/lesson-invoices";

export async function GET(request: Request) {
  try {
    const { error } = await requireFinancePayout();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const month = searchParams.get("month");

    if (!teacherId) return errorResponse("يجب اختيار الأستاذ");
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return errorResponse("معرّف الأستاذ غير صالح", 400);
    }

    await connectDB();

    const selectedTeacherId = normalizeId(teacherId);
    const teacher = await Teacher.findById(selectedTeacherId).lean();
    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    const { allCandidates, matched } = await getInvoicesForTeacherAccount(
      selectedTeacherId,
      month
    );

    const totalAmount = matched.reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0);

    // Temporary debug logs — remove after verifying teacher account linkage
    console.log("[TeacherAccount]", {
      selectedTeacherId,
      invoicesCount: allCandidates.length,
      invoicesFilteredByTeacherId: matched.length,
      totalAmount,
    });

    const account = computeTeacherAccount(teacher, matched);
    const formattedInvoices = matched.map((row) => formatLessonInvoice(row));

    return successResponse({
      ...account,
      teacher: {
        ...account.teacher,
        _id: selectedTeacherId,
      },
      invoices: formattedInvoices,
      month: month ?? null,
    });
  } catch (err) {
    console.error("Teacher account GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
