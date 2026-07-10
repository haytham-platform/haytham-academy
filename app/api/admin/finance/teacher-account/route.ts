import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import Teacher from "@/models/Teacher";
import TeacherPayout from "@/models/TeacherPayout";
import { requireFinancePayout } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatPayout } from "@/lib/finance";
import { getTeacherPaymentHistory } from "@/lib/teacher-payments";
import {
  computeTeacherAccount,
  formatLessonInvoice,
  getInvoicesForTeacherAccount,
  normalizeId,
} from "@/lib/lesson-invoices";

export async function GET(request: Request) {
  try {
    const { error } = await requireFinancePayout();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const month = searchParams.get("month");

    if (!teacherId) return errorResponse("يجب اختيار الأستاذ");
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return errorResponse("معرّف الأستاذ غير صالح", 400);
    }

    await connectDB();

    const selectedTeacherId = normalizeId(teacherId);
    const teacher = await Teacher.findById(selectedTeacherId).lean();
    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    const { matched } = await getInvoicesForTeacherAccount(
      selectedTeacherId,
      month
    );

    const account = computeTeacherAccount(teacher, matched);
    const formattedInvoices = matched.map((row) => formatLessonInvoice(row));
    const teacherInvoiceFilter: Record<string, unknown> = {
      recordType: "teacher_invoice",
      invoiceStatus: { $ne: "cancelled" },
      teacherId: new mongoose.Types.ObjectId(selectedTeacherId),
    };
    if (month) {
      teacherInvoiceFilter.invoicePeriod = month;
    }
    const teacherInvoices = await TeacherPayout.find(teacherInvoiceFilter)
      .populate("teacherId", "name subject")
      .populate("courseId", "title")
      .sort({ payoutDate: -1 })
      .lean();
    const outstandingTeacherInvoices = teacherInvoices.reduce(
      (sum, inv) => sum + Number(inv.remaining || 0),
      0
    );

    const teacherPaymentFilter: Record<string, unknown> = {
      teacherId: new mongoose.Types.ObjectId(selectedTeacherId),
    };
    if (month) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      teacherPaymentFilter.paymentDate = { $gte: start, $lt: end };
    }
    const teacherPayments = await getTeacherPaymentHistory(teacherPaymentFilter);

    return successResponse({
      ...account,
      teacher: {
        ...account.teacher,
        _id: selectedTeacherId,
      },
      invoices: formattedInvoices,
      teacherInvoices: teacherInvoices.map((row) => formatPayout(row)),
      teacherPayments,
      outstandingTeacherInvoices,
      month: month ?? null,
    });
  } catch (err) {
    console.error("Teacher account GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
