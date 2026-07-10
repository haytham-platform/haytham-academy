import { connectDB } from "@/lib/db";
import TeacherPayout from "@/models/TeacherPayout";
import { requireFinanceDelete, requireFinancePayout } from "@/lib/auth-helpers";
import { formatPayout, validateDate } from "@/lib/finance";
import { recordPayoutOut, reverseSourceEntry } from "@/lib/cashbox";
import { notifyFinance } from "@/lib/notifications";
import { recordFinancialAudit } from "@/lib/audit";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireFinancePayout();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    await connectDB();

    const existing = await TeacherPayout.findById(id);
    if (!existing) return errorResponse("المستحق غير موجود", 404);

    const update: Record<string, unknown> = {};
    if (body.teacherId) update.teacherId = body.teacherId;
    if (body.courseId !== undefined) update.courseId = body.courseId || undefined;
    if (body.numberOfSessions !== undefined) update.numberOfSessions = Number(body.numberOfSessions || 0);
    if (body.extraSessions !== undefined) update.extraSessions = Number(body.extraSessions || 0);
    if (body.sessionRate !== undefined) update.sessionRate = Number(body.sessionRate || 0);
    if (body.manualAdjustment !== undefined) update.manualAdjustment = Number(body.manualAdjustment || 0);
    if (body.totalDue !== undefined) {
      const totalDue = Number(body.totalDue);
      if (!Number.isFinite(totalDue) || totalDue < 0) return errorResponse("إجمالي المستحق غير صالح");
      update.totalDue = totalDue;
    }
    if (body.paid !== undefined || body.amount !== undefined) {
      const paid = Number(body.paid ?? body.amount);
      if (!Number.isFinite(paid) || paid < 0) return errorResponse("المبلغ المدفوع غير صالح");
      update.paid = paid;
      update.amount = paid;
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

    const payout = await TeacherPayout.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("teacherId", "name subject")
      .populate("courseId", "title")
      .lean();

    if (!payout) return errorResponse("المستحق غير موجود", 404);

    const newStatus = payout.status as string;
    const oldStatus = existing.status;
    const paidAmount = Number(payout.amount || 0);

    if (oldStatus === "pending" && newStatus === "paid" && paidAmount > 0) {
      await recordPayoutOut(
        id,
        paidAmount,
        `مستحق أستاذ — ${payout.note || "بدون ملاحظة"}`,
        user!._id,
        {
          teacherId: String(payout.teacherId),
          courseId: payout.courseId ? String(payout.courseId) : undefined,
          notes: String(payout.note || ""),
        }
      );
      await notifyFinance({
        title: "تم دفع مستحق أستاذ",
        message: `تم دفع مستحق أستاذ بقيمة ${paidAmount}`,
        type: "warning",
        createdBy: user!._id,
        data: {
          payoutId: id,
          amount: paidAmount,
          recordedBy: user!.name,
          time: new Date().toISOString(),
        },
      });
    } else if (oldStatus === "paid" && newStatus === "pending" && existing.amount > 0) {
      await reverseSourceEntry(
        "teacher_payout",
        id,
        existing.amount,
        "عكس: إلغاء دفع مستحق أستاذ",
        user!._id,
        "out"
      );
    }

    await recordFinancialAudit({
      userId: user!._id,
      action: oldStatus !== newStatus ? "teacher_payout.status" : "teacher_payout.update",
      recordType: "teacher_payout",
      recordId: id,
      metadata: {
        ...update,
        previousStatus: oldStatus,
        status: newStatus,
      },
    });

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
    const { user, error } = await requireFinanceDelete();
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const payout = await TeacherPayout.findByIdAndDelete(id);
    if (!payout) return errorResponse("المستحق غير موجود", 404);

    if (payout.status === "paid" && payout.amount > 0) {
      await reverseSourceEntry(
        "teacher_payout",
        id,
        payout.amount,
        "عكس: حذف مستحق أستاذ",
        user!._id,
        "out"
      );
    }

    await recordFinancialAudit({
      userId: user!._id,
      action: "teacher_payout.delete",
      recordType: "teacher_payout",
      recordId: id,
      metadata: {
        amount: payout.amount,
        totalDue: payout.totalDue,
        remaining: payout.remaining,
      },
    });

    return successResponse({ message: "تم حذف المستحق بنجاح" });
  } catch (err) {
    console.error("Finance teacher-payout DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
