import { connectDB } from "@/lib/db";
import TeacherPayout from "@/models/TeacherPayout";
import { requireFinancePayout } from "@/lib/auth-helpers";
import {
  formatPayout,
  validateDate,
} from "@/lib/finance";
import { recordPayoutOut } from "@/lib/cashbox";
import { notifyFinance } from "@/lib/notifications";
import { recordFinancialAudit } from "@/lib/audit";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { error } = await requireFinancePayout();
    if (error) return error;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const filter: Record<string, unknown> = {};
    const teacherId = searchParams.get("teacherId");
    const courseId = searchParams.get("courseId");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (teacherId) filter.teacherId = teacherId;
    if (courseId) filter.courseId = courseId;
    if (status) filter.status = status;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      filter.payoutDate = dateFilter;
    }

    const payouts = await TeacherPayout.find(filter)
      .populate("teacherId", "name subject")
      .populate("courseId", "title")
      .sort({ payoutDate: -1 })
      .lean();

    return successResponse({
      payouts: payouts.map((p) => formatPayout(p)),
    });
  } catch (err) {
    console.error("Finance teacher-payouts GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireFinancePayout();
    if (error) return error;

    const body = await request.json();
    const paidAmount = Number(body.paid ?? body.amount ?? 0);
    const totalDueInput = Number(body.totalDue || 0);
    const payoutDate = validateDate(body.payoutDate);

    if (!body.teacherId) return errorResponse("الأستاذ مطلوب");
    if (!Number.isFinite(paidAmount) || paidAmount < 0) return errorResponse("المبلغ المدفوع غير صالح");
    if (!Number.isFinite(totalDueInput) || totalDueInput < 0) return errorResponse("إجمالي المستحق غير صالح");
    if (!payoutDate) return errorResponse("تاريخ المستحق غير صالح");

    await connectDB();

    const payout = await TeacherPayout.create({
      teacherId: body.teacherId,
      courseId: body.courseId || undefined,
      numberOfSessions: Number(body.numberOfSessions || 0),
      extraSessions: Number(body.extraSessions || 0),
      sessionRate: Number(body.sessionRate || 0),
      manualAdjustment: Number(body.manualAdjustment || 0),
      totalDue: totalDueInput,
      paid: paidAmount,
      amount: paidAmount,
      payoutType: body.payoutType || "fixed",
      payoutDate,
      note: body.note?.trim() || "",
      status: body.status === "paid" ? "paid" : "pending",
      createdBy: user!._id,
    });

    if (payout.status === "paid") {
      await recordPayoutOut(
        payout._id.toString(),
        paidAmount,
        `مستحق أستاذ — ${body.note?.trim() || "بدون ملاحظة"}`,
        user!._id,
        {
          teacherId: String(body.teacherId),
          courseId: body.courseId ? String(body.courseId) : undefined,
          notes: body.note?.trim() || "",
        }
      );
      await notifyFinance({
        title: "تم دفع مستحق أستاذ",
        message: `تم دفع مستحق أستاذ بقيمة ${paidAmount}`,
        type: "warning",
        createdBy: user!._id,
        data: {
          payoutId: payout._id.toString(),
          teacherId: body.teacherId,
          courseId: body.courseId || undefined,
          amount: paidAmount,
          recordedBy: user!.name,
          time: new Date().toISOString(),
        },
      });
    }

    await recordFinancialAudit({
      userId: user!._id,
      action: payout.status === "paid" ? "teacher_payout.pay" : "teacher_payout.create",
      recordType: "teacher_payout",
      recordId: payout._id.toString(),
      metadata: {
        teacherId: body.teacherId,
        courseId: body.courseId || undefined,
        totalDue: payout.totalDue,
        paid: payout.paid,
        remaining: payout.remaining,
        numberOfSessions: payout.numberOfSessions,
        extraSessions: payout.extraSessions,
      },
    });

    const populated = await TeacherPayout.findById(payout._id)
      .populate("teacherId", "name subject")
      .populate("courseId", "title")
      .lean();

    return successResponse(
      { payout: formatPayout(populated) },
      201
    );
  } catch (err) {
    console.error("Finance teacher-payouts POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
