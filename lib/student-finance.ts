import mongoose from "mongoose";
import User from "@/models/User";
import Enrollment from "@/models/Enrollment";
import TransportSubscription from "@/models/TransportSubscription";
import {
  StudentCharge,
  StudentDebt,
  StudentDiscount,
  StudentFinancialNote,
  StudentInstallmentPlan,
  StudentPayment,
  StudentRefund,
  type IStudentCharge,
  type StudentChargeStatus,
  type StudentDiscountType,
  type StudentFeeType,
  type StudentFinancialStatus,
  type StudentPaymentMethod,
} from "@/models/StudentFinance";
import { connectDB } from "@/lib/db";
import { parseDecimal, round2 } from "@/lib/decimal";
import { recordFinancialAudit } from "@/lib/audit";
import { recordLedgerEntry, reverseSourceEntry } from "@/lib/cashbox";

export const STUDENT_FINANCIAL_STATUSES: StudentFinancialStatus[] = [
  "paid",
  "partially_paid",
  "unpaid",
  "overdue",
  "exempted",
  "refunded",
  "cancelled",
];

export const STUDENT_CHARGE_TYPES: StudentFeeType[] = [
  "registration",
  "course",
  "academic_level",
  "private_lesson",
  "kindergarten",
  "transportation",
  "books_materials",
  "exam",
  "certificate",
  "other",
];

export const STUDENT_PAYMENT_METHODS: StudentPaymentMethod[] = [
  "cash",
  "bank_transfer",
  "card",
  "online_payment",
  "baridimob",
  "other",
];

type Session = mongoose.ClientSession;

function isStandaloneTransactionError(error: unknown) {
  return error instanceof Error && error.message.includes("Transaction numbers are only allowed");
}

async function runFinancialMutation<T>(work: (session?: Session) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } catch (error) {
    if (isStandaloneTransactionError(error)) {
      return work();
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

function objectId(value: string) {
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export function amountToMinor(value: unknown) {
  const parsed = parseDecimal(value, NaN);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(round2(parsed) * 100);
}

export function minorToAmount(value: unknown) {
  return round2((Number(value) || 0) / 100);
}

function toIso(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function validDate(value: unknown, fallback?: Date) {
  if (!value) return fallback ?? null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function chargeStatus(charge: {
  status?: string;
  balanceMinor: number;
  paidAmountMinor: number;
  finalAmountMinor: number;
  dueDate: Date;
}): StudentChargeStatus {
  if (charge.status === "cancelled") return "cancelled";
  if (charge.finalAmountMinor === 0) return "exempted";
  if (charge.balanceMinor <= 0) return "paid";
  if (charge.paidAmountMinor > 0) return "partially_paid";
  if (charge.dueDate < new Date()) return "overdue";
  return "pending";
}

async function recalculateCharge(chargeId: mongoose.Types.ObjectId, session?: Session) {
  const charge = await StudentCharge.findById(chargeId).session(session ?? null);
  if (!charge) throw new Error("الرسم غير موجود");

  charge.balanceMinor = Math.max(0, charge.finalAmountMinor - charge.paidAmountMinor);
  charge.status = chargeStatus(charge);
  await charge.save({ session });
  await syncDebtForCharge(charge, session);
  return charge;
}

async function syncDebtForCharge(charge: IStudentCharge, session?: Session) {
  const now = new Date();
  const daysOverdue = Math.max(
    0,
    Math.floor((now.getTime() - charge.dueDate.getTime()) / 86_400_000)
  );

  if (charge.status === "overdue" && charge.balanceMinor > 0) {
    await StudentDebt.findOneAndUpdate(
      { chargeId: charge._id },
      {
        studentId: charge.studentId,
        chargeId: charge._id,
        originalDueDate: charge.dueDate,
        outstandingAmountMinor: charge.balanceMinor,
        daysOverdue,
        status: "open",
      },
      { upsert: true, returnDocument: "after", session }
    );
    return;
  }

  await StudentDebt.findOneAndUpdate(
    { chargeId: charge._id, status: { $in: ["open", "in_collection"] } },
    { outstandingAmountMinor: 0, status: "resolved" },
    { returnDocument: "after", session }
  );
}

export async function generateStudentReceiptNumber(session?: Session) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let i = 0; i < 5; i += 1) {
    const suffix = new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase();
    const receiptNumber = `SREC-${datePart}-${suffix}`;
    const exists = await StudentPayment.exists({ receiptNumber }).session(session ?? null);
    if (!exists) return receiptNumber;
  }
  throw new Error("تعذر توليد رقم وصل فريد");
}

export function formatStudentFeeConfig(row: unknown) {
  const record = row as Record<string, unknown>;
  return {
    _id: String(record._id),
    name: record.name,
    type: record.type,
    amount: minorToAmount(record.amountMinor),
    amountMinor: record.amountMinor,
    academicLevel: record.academicLevel ?? "",
    courseId: record.courseId?.toString?.() ?? record.courseId ?? "",
    season: record.season ?? "",
    effectiveDate: toIso(record.effectiveDate),
    expirationDate: toIso(record.expirationDate),
    isActive: Boolean(record.isActive),
    createdBy: record.createdBy?.toString?.() ?? record.createdBy,
    updatedBy: record.updatedBy?.toString?.() ?? record.updatedBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function formatStudentCharge(row: unknown) {
  const record = row as Record<string, unknown>;
  const student = record.studentId as { _id?: unknown; name?: string; phone?: string; academicLevel?: string } | undefined;
  const course = record.courseId as { _id?: unknown; title?: string; level?: string } | undefined;
  return {
    _id: String(record._id),
    studentId: student?._id?.toString?.() ?? record.studentId?.toString?.() ?? record.studentId,
    studentName: student?.name,
    studentPhone: student?.phone,
    academicLevel: student?.academicLevel,
    enrollmentId: record.enrollmentId?.toString?.() ?? record.enrollmentId ?? "",
    courseId: course?._id?.toString?.() ?? record.courseId?.toString?.() ?? record.courseId ?? "",
    courseTitle: course?.title,
    academicSeason: record.academicSeason ?? "",
    chargeType: record.chargeType,
    description: record.description,
    originalAmount: minorToAmount(record.originalAmountMinor),
    discountAmount: minorToAmount(record.discountAmountMinor),
    finalAmount: minorToAmount(record.finalAmountMinor),
    paidAmount: minorToAmount(record.paidAmountMinor),
    refundedAmount: minorToAmount(record.refundedAmountMinor),
    balance: minorToAmount(record.balanceMinor),
    dueDate: toIso(record.dueDate),
    status: record.status,
    relatedRecordType: record.relatedRecordType ?? "",
    relatedRecordId: record.relatedRecordId?.toString?.() ?? record.relatedRecordId ?? "",
    notes: record.notes ?? "",
    createdBy: record.createdBy?.toString?.() ?? record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function formatStudentPayment(row: unknown) {
  const record = row as Record<string, unknown>;
  const student = record.studentId as { _id?: unknown; name?: string; phone?: string; academicLevel?: string } | undefined;
  return {
    _id: String(record._id),
    studentId: student?._id?.toString?.() ?? record.studentId?.toString?.() ?? record.studentId,
    studentName: student?.name,
    studentPhone: student?.phone,
    academicLevel: student?.academicLevel,
    amount: minorToAmount(record.amountMinor),
    amountMinor: record.amountMinor,
    paymentDate: toIso(record.paymentDate),
    paymentMethod: record.paymentMethod,
    paymentReference: record.paymentReference ?? "",
    receiptNumber: record.receiptNumber,
    allocations: Array.isArray(record.allocations)
      ? record.allocations.map((allocation) => ({
          chargeId: allocation.chargeId?.toString?.() ?? String(allocation.chargeId),
          amount: minorToAmount(allocation.amountMinor),
          amountMinor: allocation.amountMinor,
        }))
      : [],
    academicSeason: record.academicSeason ?? "",
    notes: record.notes ?? "",
    receivedBy: record.receivedBy?.toString?.() ?? record.receivedBy,
    status: record.status,
    refundedAmount: minorToAmount(record.refundedAmountMinor),
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

function financialStatus(totalDueMinor: number, paidMinor: number, overdueMinor: number, refundsMinor: number): StudentFinancialStatus {
  if (refundsMinor > 0 && paidMinor === 0) return "refunded";
  if (totalDueMinor === 0) return "exempted";
  if (overdueMinor > 0) return "overdue";
  if (paidMinor >= totalDueMinor) return "paid";
  if (paidMinor > 0) return "partially_paid";
  return "unpaid";
}

export async function buildStudentFinancialProfile(studentId: string) {
  const id = objectId(studentId);
  if (!id) throw new Error("معرف الطالب غير صالح");
  await connectDB();

  const [student, enrollments, transport, charges, payments, discounts, refunds, notes, debts] =
    await Promise.all([
      User.findOne({ _id: id, role: "student" }).select("-password").lean(),
      Enrollment.find({ student: id })
        .populate("course", "title price level")
        .sort({ createdAt: -1 })
        .lean(),
      TransportSubscription.find({ studentId: id, status: "active" }).lean(),
      StudentCharge.find({ studentId: id, status: { $ne: "cancelled" } })
        .populate("courseId", "title level")
        .sort({ dueDate: 1 })
        .lean(),
      StudentPayment.find({ studentId: id }).sort({ paymentDate: -1 }).lean(),
      StudentDiscount.find({ studentId: id }).sort({ createdAt: -1 }).lean(),
      StudentRefund.find({ studentId: id }).sort({ refundDate: -1 }).lean(),
      StudentFinancialNote.find({ studentId: id }).sort({ createdAt: -1 }).lean(),
      StudentDebt.find({ studentId: id, status: { $in: ["open", "in_collection"] } }).lean(),
    ]);

  if (!student) throw new Error("الطالب غير موجود");

  const totalDueMinor = charges.reduce((sum, charge) => sum + Number(charge.finalAmountMinor || 0), 0);
  const totalPaidMinor = charges.reduce((sum, charge) => sum + Number(charge.paidAmountMinor || 0), 0);
  const totalDiscountMinor = charges.reduce((sum, charge) => sum + Number(charge.discountAmountMinor || 0), 0);
  const refundsMinor = refunds
    .filter((refund) => refund.status === "processed")
    .reduce((sum, refund) => sum + Number(refund.refundAmountMinor || 0), 0);
  const overdueMinor = debts.reduce((sum, debt) => sum + Number(debt.outstandingAmountMinor || 0), 0);
  const balanceMinor = Math.max(0, totalDueMinor - totalPaidMinor);

  return {
    studentId,
    studentCode: student._id.toString(),
    studentName: student.name,
    phone: student.phone ?? "",
    academicLevel: student.academicLevel ?? student.studyLevel ?? "",
    academicSeason: charges[0]?.academicSeason ?? "",
    registeredCourses: enrollments.map((enrollment) => {
      const course = enrollment.course as { _id?: { toString(): string }; title?: string; price?: number; level?: string } | null;
      return {
        enrollmentId: enrollment._id.toString(),
        courseId: course?._id?.toString?.() ?? "",
        title: course?.title ?? "",
        price: course?.price ?? 0,
        level: course?.level ?? "",
        status: enrollment.status,
      };
    }),
    hasTransportation: transport.length > 0,
    registrationFees: minorToAmount(charges.filter((c) => c.chargeType === "registration").reduce((sum, c) => sum + c.finalAmountMinor, 0)),
    courseFees: minorToAmount(charges.filter((c) => c.chargeType === "course").reduce((sum, c) => sum + c.finalAmountMinor, 0)),
    transportationFees: minorToAmount(charges.filter((c) => c.chargeType === "transportation").reduce((sum, c) => sum + c.finalAmountMinor, 0)),
    additionalServiceFees: minorToAmount(charges.filter((c) => !["registration", "course", "transportation"].includes(c.chargeType)).reduce((sum, c) => sum + c.finalAmountMinor, 0)),
    totalAmountDue: minorToAmount(totalDueMinor),
    totalAmountPaid: minorToAmount(totalPaidMinor),
    remainingBalance: minorToAmount(balanceMinor),
    overdueBalance: minorToAmount(overdueMinor),
    discountsTotal: minorToAmount(totalDiscountMinor),
    refundsTotal: minorToAmount(refundsMinor),
    financialStatus: financialStatus(totalDueMinor, totalPaidMinor, overdueMinor, refundsMinor),
    charges: charges.map(formatStudentCharge),
    paymentHistory: payments.map(formatStudentPayment),
    debtHistory: debts.map((debt) => ({
      _id: debt._id.toString(),
      chargeId: debt.chargeId.toString(),
      outstandingAmount: minorToAmount(debt.outstandingAmountMinor),
      daysOverdue: debt.daysOverdue,
      status: debt.status,
      originalDueDate: toIso(debt.originalDueDate),
      collectionNotes: debt.collectionNotes ?? "",
      lastFollowUpDate: toIso(debt.lastFollowUpDate),
    })),
    discounts: discounts.map((discount) => ({
      _id: discount._id.toString(),
      type: discount.type,
      reason: discount.reason,
      approvalStatus: discount.approvalStatus,
      appliedAmount: minorToAmount(discount.appliedAmountMinor),
      effectiveDate: toIso(discount.effectiveDate),
      notes: discount.notes ?? "",
    })),
    refunds: refunds.map((refund) => ({
      _id: refund._id.toString(),
      originalPaymentId: refund.originalPaymentId.toString(),
      refundAmount: minorToAmount(refund.refundAmountMinor),
      reason: refund.reason,
      refundDate: toIso(refund.refundDate),
      refundMethod: refund.refundMethod,
      status: refund.status,
      notes: refund.notes ?? "",
    })),
    notes: notes.map((note) => ({
      _id: note._id.toString(),
      note: note.note,
      visibility: note.visibility,
      author: note.author.toString(),
      createdAt: toIso(note.createdAt),
      updatedAt: toIso(note.updatedAt),
    })),
  };
}

export async function createStudentCharge(body: Record<string, unknown>, userId: string) {
  const studentId = objectId(String(body.studentId || ""));
  if (!studentId) throw new Error("يجب اختيار طالب صالح");
  const amountMinor = amountToMinor(body.originalAmount ?? body.amount);
  const discountMinor = amountToMinor(body.discountAmount ?? 0);
  const dueDate = validDate(body.dueDate, new Date());
  const chargeType = String(body.chargeType || "");
  if (!amountMinor || amountMinor <= 0) throw new Error("مبلغ الرسم غير صالح");
  if (discountMinor === null || discountMinor > amountMinor) throw new Error("قيمة التخفيض غير صالحة");
  if (!dueDate) throw new Error("تاريخ الاستحقاق غير صالح");
  if (!STUDENT_CHARGE_TYPES.includes(chargeType as StudentFeeType)) throw new Error("نوع الرسم غير صالح");

  const enrollmentId = body.enrollmentId ? objectId(String(body.enrollmentId)) : null;
  const courseId = body.courseId ? objectId(String(body.courseId)) : null;
  const relatedRecordId = body.relatedRecordId ? objectId(String(body.relatedRecordId)) : enrollmentId ?? courseId;
  const allowDuplicate = body.allowDuplicate === true;
  const duplicateScope =
    enrollmentId?.toString() ??
    relatedRecordId?.toString() ??
    (trim(body.serviceKey) || trim(body.description));
  const duplicateKey = allowDuplicate
    ? undefined
    : [studentId.toString(), chargeType, duplicateScope].join(":");

  await connectDB();
  if (duplicateKey) {
    const existing = await StudentCharge.findOne({ duplicateKey, status: { $ne: "cancelled" } }).lean();
    if (existing) throw new Error("يوجد رسم سابق لنفس التسجيل أو الخدمة");
  }

  const finalAmountMinor = Math.max(0, amountMinor - discountMinor);
  const charge = await StudentCharge.create({
    studentId,
    enrollmentId: enrollmentId ?? undefined,
    courseId: courseId ?? undefined,
    academicSeason: trim(body.academicSeason),
    chargeType: chargeType as StudentFeeType,
    description: trim(body.description) || "رسم طالب",
    originalAmountMinor: amountMinor,
    discountAmountMinor: discountMinor,
    finalAmountMinor,
    paidAmountMinor: 0,
    refundedAmountMinor: 0,
    balanceMinor: finalAmountMinor,
    dueDate,
    status: finalAmountMinor === 0 ? "exempted" : dueDate < new Date() ? "overdue" : "pending",
    relatedRecordType: trim(body.relatedRecordType),
    relatedRecordId: relatedRecordId ?? undefined,
    duplicateKey,
    allowDuplicate,
    createdBy: userId,
    notes: trim(body.notes),
  });

  await syncDebtForCharge(charge);
  await recordFinancialAudit({
    userId,
    action: "student_charge.create",
    recordType: "student_charge",
    recordId: charge._id.toString(),
    metadata: { newValues: formatStudentCharge(charge) },
  });

  return formatStudentCharge(charge);
}

async function allocateAutomatically(studentId: mongoose.Types.ObjectId, amountMinor: number, session?: Session) {
  const charges = await StudentCharge.find({
    studentId,
    status: { $in: ["pending", "partially_paid", "overdue"] },
    balanceMinor: { $gt: 0 },
  })
    .sort({ dueDate: 1, createdAt: 1 })
    .session(session ?? null);

  let remaining = amountMinor;
  const allocations: { chargeId: mongoose.Types.ObjectId; amountMinor: number }[] = [];
  for (const charge of charges) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, charge.balanceMinor);
    allocations.push({ chargeId: charge._id as mongoose.Types.ObjectId, amountMinor: amount });
    remaining -= amount;
  }
  if (remaining > 0) throw new Error("مبلغ الدفع أكبر من الرصيد المستحق");
  return allocations;
}

export async function createStudentPayment(body: Record<string, unknown>, userId: string) {
  const studentId = objectId(String(body.studentId || ""));
  if (!studentId) throw new Error("يجب اختيار طالب صالح");
  const amountMinor = amountToMinor(body.amount);
  const paymentDate = validDate(body.paymentDate, new Date());
  const paymentMethod = String(body.paymentMethod || "");
  if (!amountMinor || amountMinor <= 0) throw new Error("مبلغ الدفع غير صالح");
  if (!paymentDate) throw new Error("تاريخ الدفع غير صالح");
  if (!STUDENT_PAYMENT_METHODS.includes(paymentMethod as StudentPaymentMethod)) throw new Error("طريقة الدفع غير صالحة");

  await connectDB();
  const savedPayment = await runFinancialMutation(async (session) => {
    const receiptNumber = await generateStudentReceiptNumber(session);
    const rawAllocations = Array.isArray(body.allocations) ? body.allocations : [];
    const allocations = rawAllocations.length
      ? rawAllocations.map((allocation) => {
          const chargeId = objectId(String((allocation as { chargeId?: unknown }).chargeId || ""));
          const allocationAmount = amountToMinor((allocation as { amount?: unknown }).amount);
          if (!chargeId || !allocationAmount || allocationAmount <= 0) throw new Error("توزيع الدفع غير صالح");
          return { chargeId, amountMinor: allocationAmount };
        })
      : await allocateAutomatically(studentId, amountMinor, session);

    const allocationTotal = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
    if (allocationTotal !== amountMinor) throw new Error("مجموع التوزيع يجب أن يساوي مبلغ الدفع");

    for (const allocation of allocations) {
      const charge = await StudentCharge.findOne({
        _id: allocation.chargeId,
        studentId,
        status: { $in: ["pending", "partially_paid", "overdue"] },
      }).session(session ?? null);
      if (!charge) throw new Error("أحد الرسوم غير صالح للدفع");
      if (allocation.amountMinor > charge.balanceMinor) throw new Error("لا يمكن دفع مبلغ أكبر من رصيد الرسم");
      charge.paidAmountMinor += allocation.amountMinor;
      await charge.save({ session });
      await recalculateCharge(charge._id as mongoose.Types.ObjectId, session);
    }

    const payment = new StudentPayment({
      studentId,
      amountMinor,
      paymentDate,
      paymentMethod: paymentMethod as StudentPaymentMethod,
      paymentReference: trim(body.paymentReference),
      receiptNumber,
      allocations,
      academicSeason: trim(body.academicSeason),
      notes: trim(body.notes),
      receivedBy: userId,
      status: String(body.status || "completed"),
      idempotencyKey: trim(body.idempotencyKey) || undefined,
      refundedAmountMinor: 0,
    });
    await payment.save({ session });
    return payment;
  });

  if (!savedPayment) throw new Error("تعذر تسجيل الدفع");

  await recordLedgerEntry({
    type: "income",
    amount: minorToAmount(amountMinor),
    direction: "in",
    sourceType: "payment",
    sourceId: savedPayment._id.toString(),
    category: "student_payment",
    description: `دفعة طالب - ${savedPayment.receiptNumber}`,
    studentId: studentId.toString(),
    paymentMethod,
    notes: trim(body.notes),
    createdBy: userId,
  });

  await recordFinancialAudit({
    userId,
    action: "student_payment.create",
    recordType: "student_payment",
      recordId: savedPayment._id.toString(),
      metadata: { newValues: formatStudentPayment(savedPayment) },
  });

  return formatStudentPayment(savedPayment);
}

export async function cancelStudentPayment(paymentId: string, reason: string, userId: string) {
  const id = objectId(paymentId);
  if (!id) throw new Error("معرف الدفع غير صالح");
  if (!trim(reason)) throw new Error("سبب الإلغاء مطلوب");

  await connectDB();
  const payment = await runFinancialMutation(async (session) => {
    const payment = await StudentPayment.findOne({ _id: id, status: "completed" }).session(session ?? null);
    if (!payment) throw new Error("الدفع غير موجود أو غير قابل للإلغاء");
    for (const allocation of payment.allocations) {
      const charge = await StudentCharge.findById(allocation.chargeId).session(session ?? null);
      if (!charge) continue;
      charge.paidAmountMinor = Math.max(0, charge.paidAmountMinor - allocation.amountMinor);
      await charge.save({ session });
      await recalculateCharge(charge._id as mongoose.Types.ObjectId, session);
    }
    payment.status = "cancelled";
    payment.cancelledAt = new Date();
    payment.cancelledBy = new mongoose.Types.ObjectId(userId);
    payment.cancellationReason = reason;
    await payment.save({ session });
    return payment;
  });

  await reverseSourceEntry("payment", paymentId, minorToAmount(payment.amountMinor), `إلغاء دفعة طالب - ${reason}`, userId, "in");
  await recordFinancialAudit({
    userId,
    action: "student_payment.cancel",
    recordType: "student_payment",
    recordId: paymentId,
    metadata: { reason },
  });

  return formatStudentPayment(payment);
}

export async function createStudentDiscount(body: Record<string, unknown>, userId: string) {
  const studentId = objectId(String(body.studentId || ""));
  const chargeId = body.chargeId ? objectId(String(body.chargeId)) : null;
  if (!studentId) throw new Error("يجب اختيار طالب صالح");
  const type = String(body.type || "");
  const effectiveDate = validDate(body.effectiveDate, new Date());
  if (!effectiveDate) throw new Error("تاريخ التخفيض غير صالح");

  await connectDB();
  const discount = await runFinancialMutation(async (session) => {
    let appliedAmountMinor = 0;
    let charge: IStudentCharge | null = null;
    if (chargeId) {
      charge = await StudentCharge.findOne({ _id: chargeId, studentId, status: { $ne: "cancelled" } }).session(session ?? null);
      if (!charge) throw new Error("الرسم غير موجود");
      if (["percentage", "sibling", "promotional"].includes(type)) {
        const percentage = Number(body.percentage ?? body.value ?? 0);
        if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) throw new Error("نسبة التخفيض غير صالحة");
        appliedAmountMinor = Math.min(charge.balanceMinor, Math.round((charge.originalAmountMinor * percentage) / 100));
      } else if (["full_exemption", "scholarship"].includes(type)) {
        appliedAmountMinor = charge.balanceMinor;
      } else {
        const valueMinor = amountToMinor(body.value);
        if (!valueMinor || valueMinor <= 0) throw new Error("قيمة التخفيض غير صالحة");
        appliedAmountMinor = Math.min(charge.balanceMinor, valueMinor);
      }
      charge.discountAmountMinor += appliedAmountMinor;
      charge.finalAmountMinor = Math.max(0, charge.finalAmountMinor - appliedAmountMinor);
      await charge.save({ session });
      await recalculateCharge(charge._id as mongoose.Types.ObjectId, session);
    }

    const discount = new StudentDiscount({
      studentId,
      chargeId: chargeId ?? undefined,
      type: type as StudentDiscountType,
      valueMinor: amountToMinor(body.value) ?? undefined,
      percentage: body.percentage !== undefined ? Number(body.percentage) : undefined,
      appliedAmountMinor,
      reason: trim(body.reason) || "تخفيض",
      approvalStatus: "approved",
      approvedBy: userId,
      effectiveDate,
      notes: trim(body.notes),
      createdBy: userId,
    });
    await discount.save({ session });
    return discount;
  });

  await recordFinancialAudit({
    userId,
    action: type.includes("exemption") || type === "scholarship" ? "student_exemption.create" : "student_discount.create",
    recordType: "student_discount",
    recordId: discount._id.toString(),
    metadata: { newValues: discount },
  });
  return discount;
}

export async function createStudentRefund(body: Record<string, unknown>, userId: string) {
  const paymentId = objectId(String(body.originalPaymentId || body.paymentId || ""));
  const refundAmountMinor = amountToMinor(body.refundAmount ?? body.amount);
  const refundDate = validDate(body.refundDate, new Date());
  const refundMethod = String(body.refundMethod || "cash");
  if (!paymentId) throw new Error("الدفع الأصلي غير صالح");
  if (!refundAmountMinor || refundAmountMinor <= 0) throw new Error("مبلغ الاسترجاع غير صالح");
  if (!refundDate) throw new Error("تاريخ الاسترجاع غير صالح");
  if (!STUDENT_PAYMENT_METHODS.includes(refundMethod as StudentPaymentMethod)) throw new Error("طريقة الاسترجاع غير صالحة");

  await connectDB();
  const refund = await runFinancialMutation(async (session) => {
    const payment = await StudentPayment.findOne({ _id: paymentId, status: { $in: ["completed", "refunded"] } }).session(session ?? null);
    if (!payment) throw new Error("الدفع الأصلي غير موجود");
    const refundable = payment.amountMinor - payment.refundedAmountMinor;
    if (refundAmountMinor > refundable) throw new Error("لا يمكن استرجاع مبلغ أكبر من المتاح");

    let remainingRefund = refundAmountMinor;
    for (const allocation of payment.allocations) {
      if (remainingRefund <= 0) break;
      const reverseAmount = Math.min(allocation.amountMinor, remainingRefund);
      const charge = await StudentCharge.findById(allocation.chargeId).session(session ?? null);
      if (charge) {
        charge.paidAmountMinor = Math.max(0, charge.paidAmountMinor - reverseAmount);
        charge.refundedAmountMinor += reverseAmount;
        await charge.save({ session });
        await recalculateCharge(charge._id as mongoose.Types.ObjectId, session);
      }
      remainingRefund -= reverseAmount;
    }

    payment.refundedAmountMinor += refundAmountMinor;
    payment.status = payment.refundedAmountMinor >= payment.amountMinor ? "refunded" : "completed";
    await payment.save({ session });

    const refund = new StudentRefund({
      studentId: payment.studentId,
      originalPaymentId: payment._id,
      refundAmountMinor,
      reason: trim(body.reason) || "استرجاع",
      refundDate,
      refundMethod: refundMethod as StudentPaymentMethod,
      approvedBy: userId,
      processedBy: userId,
      status: "processed",
      notes: trim(body.notes),
    });
    await refund.save({ session });
    return refund;
  });

  await reverseSourceEntry("payment", paymentId.toString(), minorToAmount(refundAmountMinor), `استرجاع دفعة طالب - ${trim(body.reason)}`, userId, "in");
  await recordFinancialAudit({
    userId,
    action: "student_refund.create",
    recordType: "student_refund",
    recordId: refund._id.toString(),
    metadata: { paymentId: paymentId.toString(), refundAmount: minorToAmount(refundAmountMinor) },
  });
  return refund;
}

export async function createInstallmentPlan(body: Record<string, unknown>, userId: string) {
  const studentId = objectId(String(body.studentId || ""));
  if (!studentId) throw new Error("يجب اختيار طالب صالح");
  const chargeIds = Array.isArray(body.chargeIds)
    ? body.chargeIds.map((id) => objectId(String(id))).filter(Boolean) as mongoose.Types.ObjectId[]
    : [];
  const totalAmountMinor = amountToMinor(body.totalAmount);
  const numberOfInstallments = Number(body.numberOfInstallments);
  if (!totalAmountMinor || totalAmountMinor <= 0) throw new Error("إجمالي التقسيط غير صالح");
  if (!Number.isInteger(numberOfInstallments) || numberOfInstallments <= 0) throw new Error("عدد الأقساط غير صالح");
  const dueDates = Array.isArray(body.dueDates) ? body.dueDates : [];
  if (dueDates.length !== numberOfInstallments) throw new Error("عدد تواريخ الاستحقاق يجب أن يساوي عدد الأقساط");
  const base = Math.floor(totalAmountMinor / numberOfInstallments);
  let remainder = totalAmountMinor - base * numberOfInstallments;
  const installments = dueDates.map((dateValue) => {
    const dueDate = validDate(dateValue);
    if (!dueDate) throw new Error("تاريخ قسط غير صالح");
    const amountMinor = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return { dueDate, amountMinor, paidAmountMinor: 0, status: (dueDate < new Date() ? "late" : "pending") as "late" | "pending" };
  });

  await connectDB();
  const plan = await StudentInstallmentPlan.create({
    studentId,
    chargeIds,
    totalAmountMinor,
    numberOfInstallments,
    installmentAmountMinor: base,
    installments,
    paidAmountMinor: 0,
    remainingAmountMinor: totalAmountMinor,
    status: "active",
    lateStatus: installments.some((item) => item.status === "late") ? "late" : "current",
    academicSeason: trim(body.academicSeason),
    notes: trim(body.notes),
    createdBy: userId,
  });

  await recordFinancialAudit({
    userId,
    action: "student_installment.create",
    recordType: "student_installment_plan",
    recordId: plan._id.toString(),
    metadata: { newValues: plan },
  });
  return plan;
}

export async function createFinancialNote(body: Record<string, unknown>, userId: string) {
  const studentId = objectId(String(body.studentId || ""));
  if (!studentId) throw new Error("يجب اختيار طالب صالح");
  if (!trim(body.note)) throw new Error("الملاحظة مطلوبة");
  await connectDB();
  const note = await StudentFinancialNote.create({
    studentId,
    note: trim(body.note),
    author: userId,
    visibility: body.visibility === "restricted" ? "restricted" : "internal",
  });
  await recordFinancialAudit({
    userId,
    action: "student_financial_note.create",
    recordType: "student_financial_note",
    recordId: note._id.toString(),
    metadata: { studentId: studentId.toString() },
  });
  return note;
}

export async function getStudentFinanceStats() {
  await connectDB();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    chargeAgg,
    paymentAgg,
    debtAgg,
    discountAgg,
    refundAgg,
    todayPayments,
    weekPayments,
    monthPayments,
    statusAgg,
    methodAgg,
    recentPayments,
  ] = await Promise.all([
    StudentCharge.aggregate([{ $match: { status: { $ne: "cancelled" } } }, { $group: { _id: null, total: { $sum: "$finalAmountMinor" }, outstanding: { $sum: "$balanceMinor" } } }]),
    StudentPayment.aggregate([{ $match: { status: { $in: ["completed", "refunded"] } } }, { $group: { _id: null, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } }]),
    StudentDebt.aggregate([{ $match: { status: { $in: ["open", "in_collection"] } } }, { $group: { _id: null, total: { $sum: "$outstandingAmountMinor" }, count: { $sum: 1 } } }]),
    StudentDiscount.aggregate([{ $match: { approvalStatus: "approved" } }, { $group: { _id: null, total: { $sum: "$appliedAmountMinor" } } }]),
    StudentRefund.aggregate([{ $match: { status: "processed" } }, { $group: { _id: null, total: { $sum: "$refundAmountMinor" } } }]),
    StudentPayment.aggregate([{ $match: { status: { $in: ["completed", "refunded"] }, paymentDate: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } }]),
    StudentPayment.aggregate([{ $match: { status: { $in: ["completed", "refunded"] }, paymentDate: { $gte: weekStart } } }, { $group: { _id: null, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } }]),
    StudentPayment.aggregate([{ $match: { status: { $in: ["completed", "refunded"] }, paymentDate: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } }]),
    StudentCharge.aggregate([{ $match: { status: { $ne: "cancelled" } } }, { $group: { _id: "$studentId", balance: { $sum: "$balanceMinor" }, paid: { $sum: "$paidAmountMinor" }, overdue: { $sum: { $cond: [{ $eq: ["$status", "overdue"] }, "$balanceMinor", 0] } } } }]),
    StudentPayment.aggregate([{ $match: { status: { $in: ["completed", "refunded"] } } }, { $group: { _id: "$paymentMethod", total: { $sum: "$amountMinor" }, count: { $sum: 1 } } }]),
    StudentPayment.find({ status: { $in: ["completed", "refunded"] } }).populate("studentId", "name phone").sort({ paymentDate: -1 }).limit(10).lean(),
  ]);

  let fullyPaidStudents = 0;
  let partiallyPaidStudents = 0;
  let unpaidStudents = 0;
  let overdueStudents = 0;
  for (const row of statusAgg) {
    if (row.overdue > 0) overdueStudents += 1;
    else if (row.balance <= 0) fullyPaidStudents += 1;
    else if (row.paid > 0) partiallyPaidStudents += 1;
    else unpaidStudents += 1;
  }

  return {
    totalStudentCharges: minorToAmount(chargeAgg[0]?.total ?? 0),
    totalCollectedAmount: minorToAmount(paymentAgg[0]?.total ?? 0),
    totalOutstandingBalance: minorToAmount(chargeAgg[0]?.outstanding ?? 0),
    totalOverdueAmount: minorToAmount(debtAgg[0]?.total ?? 0),
    paymentsToday: minorToAmount(todayPayments[0]?.total ?? 0),
    paymentsThisWeek: minorToAmount(weekPayments[0]?.total ?? 0),
    paymentsThisMonth: minorToAmount(monthPayments[0]?.total ?? 0),
    fullyPaidStudents,
    partiallyPaidStudents,
    unpaidStudents,
    overdueStudents,
    discountsTotal: minorToAmount(discountAgg[0]?.total ?? 0),
    refundsTotal: minorToAmount(refundAgg[0]?.total ?? 0),
    revenueByPaymentMethod: methodAgg.map((row) => ({ paymentMethod: row._id, total: minorToAmount(row.total), count: row.count })),
    recentFinancialTransactions: recentPayments.map(formatStudentPayment),
  };
}
