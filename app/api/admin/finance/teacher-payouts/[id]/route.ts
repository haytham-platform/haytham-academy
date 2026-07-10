import { connectDB } from "@/lib/db";
import TeacherPayout from "@/models/TeacherPayout";
import Teacher from "@/models/Teacher";
import { requireFinanceDelete, requireFinancePayout } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { formatPayout, validateDate } from "@/lib/finance";
import { recordPayoutOut, reverseSourceEntry } from "@/lib/cashbox";
import { notifyFinance } from "@/lib/notifications";
import { recordFinancialAudit } from "@/lib/audit";
import { successResponse, errorResponse } from "@/lib/api-response";
import { decimalsSumTo100, parseDecimal, round2 } from "@/lib/decimal";

function rounded(value: number) {
  return round2(value);
}

function computeInvoiceAmounts(input: {
  numberOfSessions: number;
  sessionRate: number;
  administrationPercentage: number;
  teacherPercentage: number;
  deductions: number;
  manualAdjustment: number;
}) {
  const grossAmount = rounded(input.numberOfSessions * input.sessionRate);
  const administrationShare = rounded((grossAmount * input.administrationPercentage) / 100);
  const teacherShareAmount = rounded((grossAmount * input.teacherPercentage) / 100);
  const netTeacherAmount = rounded(Math.max(0, teacherShareAmount - input.deductions + input.manualAdjustment));

  return {
    grossAmount,
    administrationShare,
    teacherShareAmount,
    netTeacherAmount,
  };
}

async function registerPayment(params: {
  id: string;
  amount: number;
  teacherId: string;
  courseId?: string;
  paymentMethod?: string;
  note?: string;
  userId: string;
  userName?: string;
}) {
  await recordPayoutOut(
    params.id,
    params.amount,
    `دفع فاتورة أستاذ — ${params.note || "بدون ملاحظات"}`,
    params.userId,
    {
      teacherId: params.teacherId,
      courseId: params.courseId,
      paymentMethod: params.paymentMethod,
      notes: params.note || "",
    }
  );

  await notifyFinance({
    title: "تم تسجيل دفع فاتورة أستاذ",
    message: `تم دفع مبلغ ${params.amount} من فاتورة أستاذ`,
    type: "warning",
    createdBy: params.userId,
    data: {
      payoutId: params.id,
      amount: params.amount,
      recordedBy: params.userName,
      time: new Date().toISOString(),
    },
  });
}

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
    const previousPaid = Number(existing.paid || 0);
    const previousRemaining = Number(existing.remaining || 0);
    if (existing.invoiceStatus === "cancelled" && body.invoiceStatus !== "active") {
      return errorResponse("لا يمكن تعديل فاتورة ملغاة", 400);
    }

    const update: Record<string, unknown> = {};
    const canOverride = hasPermission(user!.role, "finance.manage") || hasPermission(user!.role, "finance.owner");
    const isTeacherInvoice = existing.recordType === "teacher_invoice" || body.recordType === "teacher_invoice";

    if (body.invoiceStatus === "cancelled") {
      update.invoiceStatus = "cancelled";
      update.status = "pending";
      update.paid = 0;
      update.amount = 0;
    } else {
      if (body.teacherId) update.teacherId = body.teacherId;
      if (body.courseId !== undefined) update.courseId = body.courseId || undefined;
      if (body.academicSeason !== undefined) update.academicSeason = body.academicSeason?.trim() || "";
      if (body.invoicePeriod !== undefined) update.invoicePeriod = body.invoicePeriod?.trim() || "";
      if (Array.isArray(body.completedSessionIds)) update.completedSessionIds = body.completedSessionIds;
      if (body.numberOfSessions !== undefined) update.numberOfSessions = parseDecimal(body.numberOfSessions);
      if (body.extraSessions !== undefined) update.extraSessions = parseDecimal(body.extraSessions);
      if (body.sessionRate !== undefined) update.sessionRate = parseDecimal(body.sessionRate);
      if (body.administrationPercentage !== undefined) update.administrationPercentage = parseDecimal(body.administrationPercentage);
      if (body.teacherPercentage !== undefined) update.teacherPercentage = parseDecimal(body.teacherPercentage);
      if (body.deductions !== undefined) update.deductions = parseDecimal(body.deductions);
      if (body.manualAdjustment !== undefined) update.manualAdjustment = parseDecimal(body.manualAdjustment);

      if (isTeacherInvoice) {
        const teacherId = String(update.teacherId || existing.teacherId);
        const teacher = await Teacher.findById(teacherId).lean();
        if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

        const numberOfSessions = parseDecimal(update.numberOfSessions ?? existing.numberOfSessions ?? 0);
        const sessionRate = parseDecimal(update.sessionRate ?? existing.sessionRate ?? 0);
        const administrationPercentage = parseDecimal(update.administrationPercentage ?? existing.administrationPercentage ?? teacher.adminShare ?? 0);
        const teacherPercentage = parseDecimal(update.teacherPercentage ?? existing.teacherPercentage ?? 100 - administrationPercentage);
        const deductions = parseDecimal(update.deductions ?? existing.deductions ?? 0);
        const manualAdjustment = parseDecimal(update.manualAdjustment ?? existing.manualAdjustment ?? 0);
        const computed = computeInvoiceAmounts({
          numberOfSessions,
          sessionRate,
          administrationPercentage,
          teacherPercentage,
          deductions,
          manualAdjustment,
        });
        const requestedTotalDue =
          body.totalDue === undefined || body.totalDue === ""
            ? computed.netTeacherAmount
            : parseDecimal(body.totalDue);

        if (numberOfSessions <= 0) return errorResponse("عدد الحصص المنجزة يجب أن يكون أكبر من صفر");
        if (sessionRate < 0) return errorResponse("سعر الحصة غير صالح");
        if (deductions < 0) return errorResponse("الخصومات لا يمكن أن تكون سالبة");
        if (!Number.isFinite(requestedTotalDue) || requestedTotalDue < 0) return errorResponse("صافي مستحق الأستاذ غير صالح");
        if (!decimalsSumTo100(teacherPercentage, administrationPercentage)) {
          return errorResponse("يجب أن يكون مجموع نسبة الأستاذ ونسبة الإدارة 100%");
        }
        if (Math.abs(requestedTotalDue - computed.netTeacherAmount) > 0.01 && !canOverride) {
          return errorResponse("ليست لديك صلاحية تعديل المبلغ المحسوب يدوياً", 403);
        }

        update.grossAmount = computed.grossAmount;
        update.administrationShare = computed.administrationShare;
        update.teacherShareAmount = computed.teacherShareAmount;
        update.netTeacherAmount = computed.netTeacherAmount;
        update.totalDue = round2(requestedTotalDue);

        const invoicePeriod = String(update.invoicePeriod || existing.invoicePeriod || "").trim();
        const courseId = String(update.courseId || existing.courseId || "");
        if (!courseId) return errorResponse("المادة أو الدورة مطلوبة");
        if (!invoicePeriod) return errorResponse("شهر أو فترة الفاتورة مطلوبة");

        const duplicate = await TeacherPayout.findOne({
          _id: { $ne: existing._id },
          recordType: "teacher_invoice",
          invoiceStatus: { $ne: "cancelled" },
          teacherId,
          courseId,
          invoicePeriod,
        }).lean();
        if (duplicate) {
          return errorResponse("توجد فاتورة أستاذ مسجلة لنفس الأستاذ والمادة والفترة", 409);
        }
      } else if (body.totalDue !== undefined) {
        const totalDue = parseDecimal(body.totalDue);
        if (!Number.isFinite(totalDue) || totalDue < 0) return errorResponse("إجمالي المستحق غير صالح");
        update.totalDue = round2(totalDue);
      }

      if (body.payoutType) update.payoutType = body.payoutType;
      if (body.payoutDate) {
        const payoutDate = validateDate(body.payoutDate);
        if (!payoutDate) return errorResponse("تاريخ الفاتورة غير صالح");
        update.payoutDate = payoutDate;
      }
      if (body.paymentMethod !== undefined) update.paymentMethod = body.paymentMethod || "";
      if (body.paymentDate) {
        const paymentDate = validateDate(body.paymentDate);
        if (!paymentDate) return errorResponse("تاريخ الدفع غير صالح");
        update.paymentDate = paymentDate;
      }
      if (body.note !== undefined) update.note = body.note?.trim() || "";

      if (body.registerPayment) {
        const paymentAmount = round2(parseDecimal(body.paymentAmount));
        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return errorResponse("مبلغ الدفع يجب أن يكون أكبر من صفر");
        if (paymentAmount > previousRemaining) return errorResponse("مبلغ الدفع أكبر من المبلغ المتبقي");
        update.paid = round2(previousPaid + paymentAmount);
        update.amount = update.paid;
        update.paymentDate = body.paymentDate ? validateDate(body.paymentDate) || new Date() : new Date();
        update.paymentMethod = body.paymentMethod || existing.paymentMethod || "cash";
      } else if (body.paid !== undefined || body.amount !== undefined) {
        const paid = round2(parseDecimal(body.paid ?? body.amount));
        if (!Number.isFinite(paid) || paid < 0) return errorResponse("المبلغ المدفوع غير صالح");
        const totalDue = parseDecimal(update.totalDue ?? existing.totalDue ?? 0);
        if (paid > totalDue) return errorResponse("المبلغ المدفوع لا يمكن أن يتجاوز المستحق");
        update.paid = paid;
        update.amount = paid;
      }
    }

    existing.set(update);
    const payoutDoc = await existing.save();

    const paidDelta = round2(Number(payoutDoc.paid || 0) - previousPaid);
    if (paidDelta > 0) {
      await registerPayment({
        id,
        amount: paidDelta,
        teacherId: payoutDoc.teacherId.toString(),
        courseId: payoutDoc.courseId?.toString(),
        paymentMethod: payoutDoc.paymentMethod || "cash",
        note: payoutDoc.note || "",
        userId: user!._id,
        userName: user!.name,
      });
    } else if ((body.invoiceStatus === "cancelled" || paidDelta < 0) && previousPaid > 0) {
      await reverseSourceEntry(
        "teacher_payout",
        id,
        paidDelta < 0 ? Math.abs(paidDelta) : previousPaid,
        body.invoiceStatus === "cancelled" ? "عكس: إلغاء فاتورة أستاذ" : "عكس: تعديل دفع فاتورة أستاذ",
        user!._id,
        "out"
      );
    }

    if (body.invoiceStatus === "cancelled") {
      await notifyFinance({
        title: "تم إلغاء فاتورة أستاذ",
        message: "تم إلغاء فاتورة أستاذ وتحديث الرصيد",
        type: "warning",
        createdBy: user!._id,
        data: { payoutId: id, time: new Date().toISOString() },
      });
    }

    await recordFinancialAudit({
      userId: user!._id,
      action: body.invoiceStatus === "cancelled" ? "teacher_invoice.cancel" : paidDelta > 0 ? "teacher_invoice.pay" : "teacher_invoice.update",
      recordType: "teacher_payout",
      recordId: id,
      metadata: {
        ...update,
        paidDelta,
        previousPaid,
        paid: payoutDoc.paid,
        remaining: payoutDoc.remaining,
      },
    });

    const payout = await TeacherPayout.findById(id)
      .populate("teacherId", "name subject")
      .populate("courseId", "title")
      .lean();

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

    if (payout.paid > 0) {
      await reverseSourceEntry(
        "teacher_payout",
        id,
        payout.paid,
        "عكس: حذف مستحق أستاذ",
        user!._id,
        "out"
      );
    }

    await recordFinancialAudit({
      userId: user!._id,
      action: payout.recordType === "teacher_invoice" ? "teacher_invoice.delete" : "teacher_payout.delete",
      recordType: "teacher_payout",
      recordId: id,
      metadata: {
        amount: payout.amount,
        totalDue: payout.totalDue,
        remaining: payout.remaining,
        recordType: payout.recordType,
      },
    });

    return successResponse({ message: "تم حذف المستحق بنجاح" });
  } catch (err) {
    console.error("Finance teacher-payout DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
