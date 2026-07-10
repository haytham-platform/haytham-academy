import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import { requireFinanceDelete, requireFinanceManager } from "@/lib/auth-helpers";
import {
  formatPayment,
  validateAmount,
  validateDate,
} from "@/lib/finance";
import { reverseSourceEntry } from "@/lib/cashbox";
import { recordFinancialAudit } from "@/lib/audit";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireFinanceManager();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    await connectDB();

    const update: Record<string, unknown> = {};
    if (body.studentId) update.studentId = body.studentId;
    if (body.courseId) update.courseId = body.courseId;
    if (body.enrollmentId !== undefined) update.enrollmentId = body.enrollmentId || undefined;
    if (body.amount !== undefined) {
      const amount = validateAmount(body.amount);
      if (!amount) return errorResponse("المبلغ يجب أن يكون أكبر من صفر");
      update.amount = amount;
    }
    if (body.paymentMethod) update.paymentMethod = body.paymentMethod;
    if (body.paymentDate) {
      const paymentDate = validateDate(body.paymentDate);
      if (!paymentDate) return errorResponse("تاريخ الدفع غير صالح");
      update.paymentDate = paymentDate;
    }
    if (body.type) update.type = body.type;
    if (body.note !== undefined) update.note = body.note?.trim() || "";

    const payment = await Payment.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("studentId", "name phone")
      .populate("courseId", "title")
      .lean();

    if (!payment) return errorResponse("الدفعة غير موجودة", 404);

    await recordFinancialAudit({
      userId: user!._id,
      action: "payment.update",
      recordType: "payment",
      recordId: id,
      metadata: update,
    });

    return successResponse({
      payment: formatPayment(payment),
    });
  } catch (err) {
    console.error("Finance payment PUT:", err);
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

    const payment = await Payment.findByIdAndDelete(id);
    if (!payment) return errorResponse("الدفعة غير موجودة", 404);

    await reverseSourceEntry(
      "payment",
      id,
      payment.amount,
      "عكس: حذف دفعة",
      user!._id,
      "in"
    );

    await recordFinancialAudit({
      userId: user!._id,
      action: "payment.delete",
      recordType: "payment",
      recordId: id,
      metadata: {
        receiptNumber: payment.receiptNumber,
        amount: payment.amount,
      },
    });

    return successResponse({ message: "تم حذف الدفعة بنجاح" });
  } catch (err) {
    console.error("Finance payment DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
