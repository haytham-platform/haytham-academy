import { connectDB } from "@/lib/db";
import TeacherPayout from "@/models/TeacherPayout";
import Teacher from "@/models/Teacher";
import { requireFinancePayout } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { formatPayout, validateDate } from "@/lib/finance";
import { recordPayoutOut } from "@/lib/cashbox";
import { notifyFinance } from "@/lib/notifications";
import { recordFinancialAudit } from "@/lib/audit";
import { successResponse, errorResponse } from "@/lib/api-response";
import { decimalsSumTo100, parseDecimal, round2 } from "@/lib/decimal";

function rounded(value: number) {
  return round2(value);
}

function deriveInvoiceAmounts(body: Record<string, unknown>, teacherAdminShare: number) {
  const numberOfSessions = parseDecimal(body.numberOfSessions);
  const sessionRate = parseDecimal(body.sessionRate);
  const grossAmount = rounded(numberOfSessions * sessionRate);
  const administrationPercentage = parseDecimal(body.administrationPercentage ?? teacherAdminShare ?? 0);
  const teacherPercentage = parseDecimal(body.teacherPercentage ?? 100 - administrationPercentage);
  const administrationShare = rounded((grossAmount * administrationPercentage) / 100);
  const teacherShareAmount = rounded((grossAmount * teacherPercentage) / 100);
  const deductions = parseDecimal(body.deductions);
  const manualAdjustment = parseDecimal(body.manualAdjustment);
  const netTeacherAmount = rounded(Math.max(0, teacherShareAmount - deductions + manualAdjustment));
  const requestedTotalDue = body.totalDue === undefined || body.totalDue === "" ? netTeacherAmount : parseDecimal(body.totalDue);

  return {
    numberOfSessions,
    sessionRate,
    grossAmount,
    administrationPercentage,
    teacherPercentage,
    administrationShare,
    teacherShareAmount,
    deductions,
    manualAdjustment,
    netTeacherAmount,
    totalDue: requestedTotalDue,
    wasOverridden: Math.abs(requestedTotalDue - netTeacherAmount) > 0.01,
  };
}

async function recordTeacherPayment(params: {
  payoutId: string;
  amount: number;
  teacherId: string;
  courseId?: string;
  paymentMethod?: string;
  note?: string;
  userId: string;
  userName?: string;
}) {
  await recordPayoutOut(
    params.payoutId,
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
      payoutId: params.payoutId,
      teacherId: params.teacherId,
      courseId: params.courseId,
      amount: params.amount,
      recordedBy: params.userName,
      time: new Date().toISOString(),
    },
  });
}

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
    const recordType = searchParams.get("recordType");
    const invoiceStatus = searchParams.get("invoiceStatus");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (teacherId) filter.teacherId = teacherId;
    if (courseId) filter.courseId = courseId;
    if (status) filter.status = status;
    if (recordType) filter.recordType = recordType;
    if (invoiceStatus) filter.invoiceStatus = invoiceStatus;
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
    const recordType = body.recordType === "teacher_invoice" ? "teacher_invoice" : "payout";
    const paidAmount = round2(parseDecimal(body.paid ?? body.amount ?? 0));
    const payoutDate = validateDate(body.payoutDate);
    const paymentDate = body.paymentDate ? validateDate(body.paymentDate) : undefined;

    if (!body.teacherId) return errorResponse("الأستاذ مطلوب");
    if (!Number.isFinite(paidAmount) || paidAmount < 0) return errorResponse("المبلغ المدفوع غير صالح");
    if (!payoutDate) return errorResponse("تاريخ الفاتورة غير صالح");

    await connectDB();

    const teacher = await Teacher.findById(body.teacherId).lean();
    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    const canOverride = hasPermission(user!.role, "finance.manage") || hasPermission(user!.role, "finance.owner");
    const invoiceAmounts = deriveInvoiceAmounts(body, Number(teacher.adminShare ?? 0));
    const totalDueInput =
      recordType === "teacher_invoice" ? invoiceAmounts.totalDue : parseDecimal(body.totalDue);

    if (!Number.isFinite(totalDueInput) || totalDueInput < 0) {
      return errorResponse("إجمالي المستحق غير صالح");
    }
    if (recordType === "teacher_invoice") {
      if (!body.courseId) return errorResponse("المادة أو الدورة مطلوبة");
      if (!body.invoicePeriod?.trim()) return errorResponse("شهر أو فترة الفاتورة مطلوبة");
      if (invoiceAmounts.numberOfSessions <= 0) return errorResponse("عدد الحصص المنجزة يجب أن يكون أكبر من صفر");
      if (invoiceAmounts.sessionRate < 0) return errorResponse("سعر الحصة غير صالح");
      if (invoiceAmounts.deductions < 0) return errorResponse("الخصومات لا يمكن أن تكون سالبة");
      if (paidAmount > totalDueInput) return errorResponse("المبلغ المدفوع لا يمكن أن يتجاوز صافي مستحق الأستاذ");
      if (!decimalsSumTo100(invoiceAmounts.teacherPercentage, invoiceAmounts.administrationPercentage)) {
        return errorResponse("يجب أن يكون مجموع نسبة الأستاذ ونسبة الإدارة 100%");
      }
      if (invoiceAmounts.wasOverridden && !canOverride) {
        return errorResponse("ليست لديك صلاحية تعديل المبلغ المحسوب يدوياً", 403);
      }

      const duplicate = await TeacherPayout.findOne({
        recordType: "teacher_invoice",
        invoiceStatus: { $ne: "cancelled" },
        teacherId: body.teacherId,
        courseId: body.courseId,
        invoicePeriod: body.invoicePeriod.trim(),
      }).lean();
      if (duplicate) {
        return errorResponse("توجد فاتورة أستاذ مسجلة لنفس الأستاذ والمادة والفترة", 409);
      }
    }

    const payout = await TeacherPayout.create({
      teacherId: body.teacherId,
      courseId: body.courseId || undefined,
      recordType,
      academicSeason: body.academicSeason?.trim() || "",
      invoicePeriod: body.invoicePeriod?.trim() || "",
      completedSessionIds: Array.isArray(body.completedSessionIds) ? body.completedSessionIds : [],
      numberOfSessions: parseDecimal(body.numberOfSessions),
      extraSessions: parseDecimal(body.extraSessions),
      sessionRate: parseDecimal(body.sessionRate),
      grossAmount: recordType === "teacher_invoice" ? invoiceAmounts.grossAmount : parseDecimal(body.grossAmount),
      administrationPercentage:
        recordType === "teacher_invoice" ? invoiceAmounts.administrationPercentage : parseDecimal(body.administrationPercentage),
      teacherPercentage:
        recordType === "teacher_invoice" ? invoiceAmounts.teacherPercentage : parseDecimal(body.teacherPercentage),
      administrationShare:
        recordType === "teacher_invoice" ? invoiceAmounts.administrationShare : parseDecimal(body.administrationShare),
      teacherShareAmount:
        recordType === "teacher_invoice" ? invoiceAmounts.teacherShareAmount : parseDecimal(body.teacherShareAmount),
      deductions: recordType === "teacher_invoice" ? invoiceAmounts.deductions : parseDecimal(body.deductions),
      netTeacherAmount:
        recordType === "teacher_invoice" ? invoiceAmounts.netTeacherAmount : parseDecimal(body.netTeacherAmount),
      manualAdjustment:
        recordType === "teacher_invoice" ? invoiceAmounts.manualAdjustment : parseDecimal(body.manualAdjustment),
      totalDue: round2(totalDueInput),
      paid: paidAmount,
      amount: paidAmount,
      payoutType: body.payoutType || (recordType === "teacher_invoice" ? "per_session" : "fixed"),
      payoutDate,
      paymentDate: paidAmount > 0 ? paymentDate || new Date() : undefined,
      paymentMethod: paidAmount > 0 ? body.paymentMethod || "cash" : "",
      note: body.note?.trim() || "",
      invoiceStatus: "active",
      createdBy: user!._id,
    });

    if (paidAmount > 0) {
      await recordTeacherPayment({
        payoutId: payout._id.toString(),
        amount: paidAmount,
        teacherId: String(body.teacherId),
        courseId: body.courseId ? String(body.courseId) : undefined,
        paymentMethod: body.paymentMethod || "cash",
        note: body.note?.trim() || "",
        userId: user!._id,
        userName: user!.name,
      });
    } else if (recordType === "teacher_invoice") {
      await notifyFinance({
        title: "تم إنشاء فاتورة أستاذ",
        message: `تم إنشاء فاتورة أستاذ بمبلغ ${payout.totalDue}`,
        type: "info",
        createdBy: user!._id,
        data: {
          payoutId: payout._id.toString(),
          teacherId: body.teacherId,
          courseId: body.courseId || undefined,
          amount: payout.totalDue,
          time: new Date().toISOString(),
        },
      });
    }

    await recordFinancialAudit({
      userId: user!._id,
      action: paidAmount > 0 ? "teacher_invoice.pay" : recordType === "teacher_invoice" ? "teacher_invoice.create" : "teacher_payout.create",
      recordType: "teacher_payout",
      recordId: payout._id.toString(),
      metadata: {
        teacherId: body.teacherId,
        courseId: body.courseId || undefined,
        totalDue: payout.totalDue,
        paid: payout.paid,
        remaining: payout.remaining,
        numberOfSessions: payout.numberOfSessions,
        invoicePeriod: payout.invoicePeriod,
        recordType,
      },
    });

    const populated = await TeacherPayout.findById(payout._id)
      .populate("teacherId", "name subject")
      .populate("courseId", "title")
      .lean();

    return successResponse({ payout: formatPayout(populated) }, 201);
  } catch (err) {
    console.error("Finance teacher-payouts POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
