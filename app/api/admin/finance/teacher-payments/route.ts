import mongoose from "mongoose";
import "@/models/User";
import "@/models/Course";
import { connectDB } from "@/lib/db";
import Teacher from "@/models/Teacher";
import TeacherPayment from "@/models/TeacherPayment";
import { requireFinancePayout } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { validateDate } from "@/lib/finance";
import { parseDecimal, round2 } from "@/lib/decimal";
import { recordPayoutOut } from "@/lib/cashbox";
import { notifyFinance } from "@/lib/notifications";
import { recordFinancialAudit } from "@/lib/audit";
import {
  formatTeacherPayment,
  getTeacherPaymentHistory,
  getTeacherOutstandingInvoices,
  invoicePaymentStatus,
  summarizeInvoices,
} from "@/lib/teacher-payments";

const VALID_PAYMENT_METHODS = ["cash", "baridimob", "bank_transfer", "other"];

export async function GET(request: Request) {
  try {
    const { error } = await requireFinancePayout();
    if (error) return error;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const filter: Record<string, unknown> = {};
    if (teacherId) {
      if (!mongoose.Types.ObjectId.isValid(teacherId)) return errorResponse("معرف الأستاذ غير صالح", 400);
      filter.teacherId = new mongoose.Types.ObjectId(teacherId);
    }
    if (status) filter.status = status;
    if (from || to) {
      const paymentDate: Record<string, Date> = {};
      if (from) paymentDate.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        paymentDate.$lte = end;
      }
      filter.paymentDate = paymentDate;
    }

    const payments = await getTeacherPaymentHistory(filter);
    return successResponse({ payments });
  } catch (err) {
    console.error("Finance teacher-payments GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireFinancePayout();
    if (error) return error;

    const body = await request.json();
    const teacherId = String(body.teacherId || "");
    const invoiceIds: string[] = Array.isArray(body.invoiceIds)
      ? body.invoiceIds.map((id: unknown) => String(id)).filter(Boolean)
      : [];
    const amount = round2(parseDecimal(body.amount));
    const paymentDate = validateDate(body.paymentDate);
    const paymentMethod = String(body.paymentMethod || "cash");
    const accountType = body.accountType === "bank" ? "bank" : "cash";
    const accountName = String(body.accountName || "").trim();
    const referenceNumber = String(body.referenceNumber || "").trim();
    const notes = String(body.notes || "").trim();
    const receiptAttachment = String(body.receiptAttachment || "").trim();

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) return errorResponse("يجب اختيار أستاذ صالح", 400);
    if (!invoiceIds.length) return errorResponse("يجب اختيار الفواتير المرتبطة بالدفع", 400);
    if (invoiceIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) return errorResponse("إحدى الفواتير المحددة غير صالحة", 400);
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse("مبلغ الدفع يجب أن يكون أكبر من صفر", 400);
    if (!paymentDate) return errorResponse("تاريخ الدفع غير صالح", 400);
    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) return errorResponse("طريقة الدفع غير صالحة", 400);

    await connectDB();

    const teacher = await Teacher.findById(teacherId).lean();
    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    if (referenceNumber) {
      const duplicateRef = await TeacherPayment.findOne({
        teacherId,
        referenceNumber,
        status: "active",
      }).lean();
      if (duplicateRef) return errorResponse("يوجد دفع مسجل بنفس رقم المرجع لهذا الأستاذ", 409);
    }

    const recentDuplicate = await TeacherPayment.findOne({
      teacherId,
      amount,
      paymentDate,
      status: "active",
      createdBy: user!._id,
      createdAt: { $gte: new Date(Date.now() - 30_000) },
    }).lean();
    if (recentDuplicate) return errorResponse("تم تسجيل هذا الدفع للتو، يرجى عدم تكرار الإرسال", 409);

    const invoices = await getTeacherOutstandingInvoices(teacherId, invoiceIds);
    if (invoices.length !== invoiceIds.length) {
      return errorResponse("بعض الفواتير غير موجودة أو لا تحتوي على رصيد متبقٍ", 400);
    }

    const summary = summarizeInvoices(invoices);
    if (amount > summary.remainingBeforePayment + 0.01) {
      return errorResponse("مبلغ الدفع أكبر من الرصيد المتبقي للأستاذ", 400);
    }

    let amountLeft = amount;
    const allocations: { invoiceId: mongoose.Types.ObjectId; amount: number }[] = [];
    for (const invoice of invoices) {
      if (amountLeft <= 0) break;
      const allocationAmount = round2(Math.min(Number(invoice.remaining || 0), amountLeft));
      if (allocationAmount <= 0) continue;
      invoice.paid = round2(Number(invoice.paid || 0) + allocationAmount);
      invoice.remaining = round2(Math.max(0, Number(invoice.totalDue || 0) - Number(invoice.paid || 0)));
      invoice.amount = invoice.paid;
      invoice.paymentDate = paymentDate;
      invoice.paymentMethod = paymentMethod;
      invoice.paymentStatus = invoicePaymentStatus(invoice.paid, invoice.remaining);
      invoice.status = invoice.remaining <= 0 ? "paid" : "pending";
      allocations.push({ invoiceId: invoice._id, amount: allocationAmount });
      amountLeft = round2(amountLeft - allocationAmount);
    }

    if (round2(amountLeft) > 0) return errorResponse("تعذر توزيع مبلغ الدفع على الفواتير المحددة", 400);

    const payment = await TeacherPayment.create({
      teacherId,
      amount,
      paymentDate,
      paymentMethod,
      accountType,
      accountName,
      referenceNumber,
      notes,
      receiptAttachment,
      allocations,
      grossEarnings: summary.grossEarnings,
      administrationShare: summary.administrationShare,
      teacherNetAmount: summary.teacherNetAmount,
      previouslyPaidAmount: summary.previouslyPaidAmount,
      remainingBeforePayment: summary.remainingBeforePayment,
      remainingAfterPayment: round2(summary.remainingBeforePayment - amount),
      createdBy: user!._id,
    });

    for (const invoice of invoices) {
      await invoice.save();
    }

    await recordPayoutOut(
      payment._id.toString(),
      amount,
      `دفع مستحقات أستاذ — ${teacher.name || "أستاذ"}`,
      user!._id,
      {
        teacherId,
        paymentMethod,
        notes: `${accountType === "bank" ? "حساب بنكي" : "صندوق نقدي"}${accountName ? ` — ${accountName}` : ""}${notes ? ` — ${notes}` : ""}`,
      }
    );

    await notifyFinance({
      title: "تم دفع مستحقات أستاذ",
      message: `تم دفع مبلغ ${amount} للأستاذ ${teacher.name || ""}`,
      type: "warning",
      createdBy: user!._id,
      data: {
        teacherPaymentId: payment._id.toString(),
        teacherId,
        amount,
        receiptNumber: payment.receiptNumber,
        time: new Date().toISOString(),
      },
    });

    await recordFinancialAudit({
      userId: user!._id,
      action: "teacher_payment.create",
      recordType: "teacher_payment",
      recordId: payment._id.toString(),
      metadata: {
        teacherId,
        amount,
        paymentMethod,
        accountType,
        accountName,
        referenceNumber,
        invoiceIds,
        allocations: allocations.map((allocation) => ({
          invoiceId: allocation.invoiceId.toString(),
          amount: allocation.amount,
        })),
      },
    });

    const populated = await TeacherPayment.findById(payment._id)
      .populate("teacherId", "name subject")
      .populate("createdBy", "name email")
      .populate({
        path: "allocations.invoiceId",
        select: "invoicePeriod courseId",
        populate: { path: "courseId", select: "title" },
      })
      .lean();

    return successResponse({ payment: formatTeacherPayment(populated) }, 201);
  } catch (err) {
    console.error("Finance teacher-payments POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
