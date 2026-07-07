import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import LessonInvoice from "@/models/LessonInvoice";
import { requireFinance } from "@/lib/auth-helpers";
import { validateDate } from "@/lib/finance";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import {
  computeTotalAmount,
  derivePaymentStatus,
  formatLessonInvoice,
  parseSessionCount,
  resolveStudentInvoiceContext,
  validateLessonInvoiceInput,
} from "@/lib/lesson-invoices";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireFinance();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    await connectDB();

    const existing = await LessonInvoice.findById(id);
    if (!existing) return errorResponse("الفاتورة غير موجودة", 404);

    const updates: Record<string, unknown> = {};

    const studentId = body.studentId ?? existing.studentId.toString();
    const enrollmentId =
      body.enrollmentId ?? existing.enrollmentId?.toString?.() ?? existing.enrollmentId;

    if (body.studentId !== undefined || body.enrollmentId !== undefined) {
      const resolved = await resolveStudentInvoiceContext(studentId, enrollmentId);
      if ("error" in resolved && resolved.error) {
        return errorResponse(resolved.error, 404);
      }
      const ctx = resolved.context!;
      if (!ctx.teacherId || !ctx.courseId) {
        return errorResponse("تعذّر تحديد الأستاذ أو الدورة من تسجيل الطالب", 404);
      }
      updates.studentId = new mongoose.Types.ObjectId(studentId);
      updates.enrollmentId = new mongoose.Types.ObjectId(ctx.enrollmentId);
      updates.courseId = new mongoose.Types.ObjectId(ctx.courseId);
      updates.teacherId = new mongoose.Types.ObjectId(ctx.teacherId);
      updates.subject = ctx.subject;
    }

    if (body.sessionCount !== undefined) {
      const sessionCount = parseSessionCount(body.sessionCount);
      if (!sessionCount) return errorResponse("عدد الحصص غير صالح");
      updates.sessionCount = sessionCount;
    }
    if (body.pricePerSession !== undefined) {
      const price = Number(body.pricePerSession);
      if (!Number.isFinite(price) || price <= 0) {
        return errorResponse("سعر الحصة يجب أن يكون أكبر من صفر");
      }
      updates.pricePerSession = price;
    }
    if (body.paidAmount !== undefined) {
      const paid = Number(body.paidAmount);
      if (!Number.isFinite(paid) || paid < 0) return errorResponse("المبلغ المدفوع غير صالح");
      updates.paidAmount = paid;
    }
    if (body.invoiceDate !== undefined) {
      const invoiceDate = validateDate(body.invoiceDate);
      if (!invoiceDate) return errorResponse("تاريخ الفاتورة غير صالح");
      updates.invoiceDate = invoiceDate;
    }
    if (body.note !== undefined) updates.note = body.note.trim();

    const sessionCount =
      (updates.sessionCount as number | undefined) ?? existing.sessionCount;
    const pricePerSession =
      (updates.pricePerSession as number | undefined) ?? existing.pricePerSession;
    const paidAmount =
      (updates.paidAmount as number | undefined) ?? existing.paidAmount;

    const validationError = validateLessonInvoiceInput({
      studentId: String(studentId),
      sessionCount,
      pricePerSession,
      paidAmount,
    });
    if (validationError) return errorResponse(validationError);

    const totalAmount = computeTotalAmount(sessionCount, pricePerSession);
    updates.totalAmount = totalAmount;
    updates.paymentStatus = derivePaymentStatus(paidAmount, totalAmount);

    const invoice = await LessonInvoice.findByIdAndUpdate(id, updates, { new: true })
      .populate("studentId", "name phone")
      .populate("teacherId", "name subject adminShare")
      .populate("courseId", "title")
      .lean();

    return successResponse({ invoice: formatLessonInvoice(invoice!) });
  } catch (err) {
    return handleRouteError("Lesson invoice PUT", err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireFinance();
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const invoice = await LessonInvoice.findByIdAndDelete(id);
    if (!invoice) return errorResponse("الفاتورة غير موجودة", 404);

    return successResponse({ message: "تم حذف الفاتورة" });
  } catch (err) {
    console.error("Lesson invoice DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
