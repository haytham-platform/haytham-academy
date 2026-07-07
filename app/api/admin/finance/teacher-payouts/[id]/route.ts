import { connectDB } from "@/lib/db";
import TeacherPayout from "@/models/TeacherPayout";
import { requireFinance } from "@/lib/auth-helpers";
import {
  formatPayout,
  validateAmount,
  validateDate,
} from "@/lib/finance";
import { recordPayoutOut, reverseSourceEntry } from "@/lib/cashbox";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireFinance();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    await connectDB();

    const existing = await TeacherPayout.findById(id);
    if (!existing) return errorResponse("المستحق غير موجود", 404);

    const update: Record<string, unknown> = {};
    if (body.teacherId) update.teacherId = body.teacherId;
    if (body.courseId !== undefined) update.courseId = body.courseId || undefined;
    if (body.amount !== undefined) {
      const amount = validateAmount(body.amount);
      if (!amount) return errorResponse("المبلغ يجب أن يكون أكبر من صفر");
      update.amount = amount;
    }
    if (body.payoutType) update.payoutType = body.payoutType;
    if (body.payoutDate) {
      const payoutDate = validateDate(body.payoutDate);
      if (!payoutDate) return errorResponse("تاريخ المستحق غير صالح");
      update.payoutDate = payoutDate;
    }
    if (body.note !== undefined) update.note = body.note?.trim() || "";
    if (body.status === "pending" || body.status === "paid") {
      update.status = body.status;
    }

    const payout = await TeacherPayout.findByIdAndUpdate(id, update, { new: true })
      .populate("teacherId", "name subject")
      .populate("courseId", "title")
      .lean();

    if (!payout) return errorResponse("المستحق غير موجود", 404);

    const newStatus = payout.status as string;
    const oldStatus = existing.status;

    if (oldStatus === "pending" && newStatus === "paid") {
      await recordPayoutOut(
        id,
        payout.amount as number,
        `مستحق أستاذ — ${payout.note || "بدون ملاحظة"}`,
        user!._id
      );
    } else if (oldStatus === "paid" && newStatus === "pending") {
      await reverseSourceEntry(
        "teacher_payout",
        id,
        existing.amount,
        "عكس: إلغاء دفع مستحق أستاذ",
        user!._id,
        "out"
      );
    }

    return successResponse({
      payout: formatPayout(payout),
    });
  } catch (err) {
    console.error("Finance teacher-payout PUT:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireFinance();
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const payout = await TeacherPayout.findByIdAndDelete(id);
    if (!payout) return errorResponse("المستحق غير موجود", 404);

    if (payout.status === "paid") {
      await reverseSourceEntry(
        "teacher_payout",
        id,
        payout.amount,
        "عكس: حذف مستحق أستاذ",
        user!._id,
        "out"
      );
    }

    return successResponse({ message: "تم حذف المستحق بنجاح" });
  } catch (err) {
    console.error("Finance teacher-payout DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
