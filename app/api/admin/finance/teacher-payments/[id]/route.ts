import mongoose from "mongoose";
import "@/models/User";
import "@/models/Course";
import { connectDB } from "@/lib/db";
import TeacherPayment from "@/models/TeacherPayment";
import TeacherPayout from "@/models/TeacherPayout";
import { requireFinancePayout } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { reverseSourceEntry } from "@/lib/cashbox";
import { notifyFinance } from "@/lib/notifications";
import { recordFinancialAudit } from "@/lib/audit";
import { formatTeacherPayment, invoicePaymentStatus } from "@/lib/teacher-payments";
import { round2 } from "@/lib/decimal";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireFinancePayout();
    if (error) return error;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse("معرف الدفع غير صالح", 400);

    await connectDB();
    const payment = await TeacherPayment.findById(id)
      .populate("teacherId", "name subject")
      .populate("createdBy", "name email")
      .populate("cancelledBy", "name email")
      .populate({
        path: "allocations.invoiceId",
        select: "invoicePeriod courseId",
        populate: { path: "courseId", select: "title" },
      })
      .lean();

    if (!payment) return errorResponse("دفع الأستاذ غير موجود", 404);
    return successResponse({ payment: formatTeacherPayment(payment) });
  } catch (err) {
    console.error("Finance teacher-payment GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireFinancePayout();
    if (error) return error;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse("معرف الدفع غير صالح", 400);

    const body = await request.json();
    if (body.action !== "cancel") {
      return errorResponse("الإجراء غير صالح", 400);
    }
    const reason = String(body.reason || "").trim();
    if (!reason) return errorResponse("سبب الإلغاء مطلوب", 400);

    await connectDB();
    const payment = await TeacherPayment.findById(id);
    if (!payment) return errorResponse("دفع الأستاذ غير موجود", 404);
    if (payment.status === "cancelled") return errorResponse("هذا الدفع ملغى مسبقاً", 400);

    for (const allocation of payment.allocations) {
      const invoice = await TeacherPayout.findById(allocation.invoiceId);
      if (!invoice) continue;
      invoice.paid = round2(Math.max(0, Number(invoice.paid || 0) - Number(allocation.amount || 0)));
      invoice.amount = invoice.paid;
      invoice.remaining = round2(Math.max(0, Number(invoice.totalDue || 0) - invoice.paid));
      invoice.paymentStatus = invoicePaymentStatus(invoice.paid, invoice.remaining);
      invoice.status = invoice.remaining <= 0 && invoice.paid > 0 ? "paid" : "pending";
      await invoice.save();
    }

    payment.status = "cancelled";
    payment.cancellationReason = reason;
    payment.cancelledBy = new mongoose.Types.ObjectId(user!._id);
    payment.cancelledAt = new Date();
    await payment.save();

    await reverseSourceEntry(
      "teacher_payout",
      payment._id.toString(),
      payment.amount,
      `عكس: إلغاء دفع أستاذ — ${reason}`,
      user!._id,
      "out"
    );

    await notifyFinance({
      title: "تم إلغاء دفع أستاذ",
      message: `تم إلغاء دفع بمبلغ ${payment.amount} وإعادة احتساب الأرصدة`,
      type: "warning",
      createdBy: user!._id,
      data: {
        teacherPaymentId: payment._id.toString(),
        teacherId: payment.teacherId.toString(),
        amount: payment.amount,
        reason,
        time: new Date().toISOString(),
      },
    });

    await recordFinancialAudit({
      userId: user!._id,
      action: "teacher_payment.cancel",
      recordType: "teacher_payment",
      recordId: payment._id.toString(),
      metadata: {
        teacherId: payment.teacherId.toString(),
        amount: payment.amount,
        reason,
        allocations: payment.allocations.map((allocation) => ({
          invoiceId: allocation.invoiceId.toString(),
          amount: allocation.amount,
        })),
      },
    });

    const populated = await TeacherPayment.findById(id)
      .populate("teacherId", "name subject")
      .populate("createdBy", "name email")
      .populate("cancelledBy", "name email")
      .populate({
        path: "allocations.invoiceId",
        select: "invoicePeriod courseId",
        populate: { path: "courseId", select: "title" },
      })
      .lean();

    return successResponse({ payment: formatTeacherPayment(populated) });
  } catch (err) {
    console.error("Finance teacher-payment PUT:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
