import { connectDB } from "@/lib/db";
import TeacherPayout from "@/models/TeacherPayout";
import { requireFinance } from "@/lib/auth-helpers";
import {
  formatPayout,
  validateAmount,
  validateDate,
} from "@/lib/finance";
import { recordPayoutOut } from "@/lib/cashbox";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { error } = await requireFinance();
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
    const { user, error } = await requireFinance();
    if (error) return error;

    const body = await request.json();
    const amount = validateAmount(body.amount);
    const payoutDate = validateDate(body.payoutDate);

    if (!body.teacherId) return errorResponse("الأستاذ مطلوب");
    if (!amount) return errorResponse("المبلغ يجب أن يكون أكبر من صفر");
    if (!payoutDate) return errorResponse("تاريخ المستحق غير صالح");

    await connectDB();

    const payout = await TeacherPayout.create({
      teacherId: body.teacherId,
      courseId: body.courseId || undefined,
      amount,
      payoutType: body.payoutType || "fixed",
      payoutDate,
      note: body.note?.trim() || "",
      status: body.status === "paid" ? "paid" : "pending",
      createdBy: user!._id,
    });

    if (payout.status === "paid") {
      await recordPayoutOut(
        payout._id.toString(),
        amount,
        `مستحق أستاذ — ${body.note?.trim() || "بدون ملاحظة"}`,
        user!._id
      );
    }

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
