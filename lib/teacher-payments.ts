import mongoose from "mongoose";
import TeacherPayment from "@/models/TeacherPayment";
import TeacherPayout from "@/models/TeacherPayout";
import { round2 } from "@/lib/decimal";

export function teacherPaymentStatusLabel(status: string) {
  if (status === "cancelled") return "ملغى";
  return "نشط";
}

export function invoicePaymentStatus(paid: number, remaining: number) {
  if (paid <= 0) return "unpaid";
  if (remaining <= 0) return "paid";
  return "partial";
}

export function formatTeacherPayment(payment: unknown) {
  const record = payment as Record<string, unknown>;
  const teacher = record.teacherId as { _id?: { toString(): string }; name?: string; subject?: string } | undefined;
  const createdBy = record.createdBy as { _id?: { toString(): string }; name?: string; email?: string } | undefined;
  const cancelledBy = record.cancelledBy as { _id?: { toString(): string }; name?: string; email?: string } | undefined;
  const allocations = Array.isArray(record.allocations) ? record.allocations : [];

  return {
    _id: (record._id as { toString(): string }).toString(),
    receiptNumber: record.receiptNumber,
    teacherId: teacher?._id?.toString?.() ?? record.teacherId?.toString?.() ?? String(record.teacherId),
    teacherName: teacher?.name,
    teacherSubject: teacher?.subject,
    amount: record.amount ?? 0,
    paymentDate: toIso(record.paymentDate),
    paymentMethod: record.paymentMethod ?? "",
    accountType: record.accountType ?? "cash",
    accountName: record.accountName ?? "",
    referenceNumber: record.referenceNumber ?? "",
    notes: record.notes ?? "",
    receiptAttachment: record.receiptAttachment ?? "",
    allocations: allocations.map((allocation) => {
      const item = allocation as Record<string, unknown>;
      const invoice = item.invoiceId as Record<string, unknown> | undefined;
      const course = invoice?.courseId as { _id?: { toString(): string }; title?: string } | undefined;
      return {
        invoiceId: invoice?._id?.toString?.() ?? item.invoiceId?.toString?.() ?? String(item.invoiceId),
        amount: item.amount ?? 0,
        invoicePeriod: invoice?.invoicePeriod ?? "",
        courseTitle: course?.title ?? "",
      };
    }),
    grossEarnings: record.grossEarnings ?? 0,
    administrationShare: record.administrationShare ?? 0,
    teacherNetAmount: record.teacherNetAmount ?? 0,
    previouslyPaidAmount: record.previouslyPaidAmount ?? 0,
    remainingBeforePayment: record.remainingBeforePayment ?? 0,
    remainingAfterPayment: record.remainingAfterPayment ?? 0,
    status: record.status ?? "active",
    cancellationReason: record.cancellationReason ?? "",
    cancelledBy: cancelledBy?.name ?? cancelledBy?.email ?? "",
    cancelledAt: toIso(record.cancelledAt),
    createdBy: createdBy?.name ?? createdBy?.email ?? record.createdBy?.toString?.() ?? String(record.createdBy ?? ""),
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export async function getTeacherPaymentHistory(filter: Record<string, unknown>) {
  const payments = await TeacherPayment.find(filter)
    .populate("teacherId", "name subject")
    .populate("createdBy", "name email")
    .populate("cancelledBy", "name email")
    .populate({
      path: "allocations.invoiceId",
      select: "invoicePeriod courseId",
      populate: { path: "courseId", select: "title" },
    })
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean();

  return payments.map((payment) => formatTeacherPayment(payment));
}

export async function getTeacherOutstandingInvoices(teacherId: string, invoiceIds?: string[]) {
  const query: Record<string, unknown> = {
    teacherId: new mongoose.Types.ObjectId(teacherId),
    recordType: "teacher_invoice",
    invoiceStatus: { $ne: "cancelled" },
    remaining: { $gt: 0 },
  };

  if (invoiceIds?.length) {
    query._id = { $in: invoiceIds.map((id) => new mongoose.Types.ObjectId(id)) };
  }

  return TeacherPayout.find(query)
    .populate("teacherId", "name subject")
    .populate("courseId", "title")
    .sort({ payoutDate: 1, createdAt: 1 });
}

export function summarizeInvoices(invoices: Array<{
  grossAmount?: number;
  administrationShare?: number;
  netTeacherAmount?: number;
  totalDue?: number;
  paid?: number;
  remaining?: number;
}>) {
  const grossEarnings = round2(invoices.reduce((sum, invoice) => sum + Number(invoice.grossAmount || 0), 0));
  const administrationShare = round2(invoices.reduce((sum, invoice) => sum + Number(invoice.administrationShare || 0), 0));
  const teacherNetAmount = round2(
    invoices.reduce((sum, invoice) => sum + Number(invoice.netTeacherAmount || invoice.totalDue || 0), 0)
  );
  const previouslyPaidAmount = round2(invoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0));
  const remainingBeforePayment = round2(invoices.reduce((sum, invoice) => sum + Number(invoice.remaining || 0), 0));

  return {
    grossEarnings,
    administrationShare,
    teacherNetAmount,
    previouslyPaidAmount,
    remainingBeforePayment,
  };
}

function toIso(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
