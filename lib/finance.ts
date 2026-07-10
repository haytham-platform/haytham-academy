import mongoose from "mongoose";
import "@/models/User";
import "@/models/Course";
import "@/models/Teacher";
import Payment from "@/models/Payment";
import Expense from "@/models/Expense";
import TeacherPayout from "@/models/TeacherPayout";
import Enrollment from "@/models/Enrollment";
import Cashbox from "@/models/Cashbox";
import CashLedger from "@/models/CashLedger";
import DailyCashClosure from "@/models/DailyCashClosure";
import { connectDB } from "@/lib/db";

export type FinancePeriod = "today" | "week" | "month" | "year";

export function getPeriodRange(period: FinancePeriod, refDate = new Date()) {
  const start = new Date(refDate);
  const end = new Date(refDate);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "week") {
    const day = start.getDay();
    const offset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - offset);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(start.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

export function parseDateRange(from?: string | null, to?: string | null) {
  const start = from ? new Date(from) : undefined;
  const end = to ? new Date(to) : undefined;
  if (end) end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function validateAmount(amount: unknown): number | null {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function validateDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function sumPayments(start: Date, end: Date, extra: Record<string, unknown> = {}) {
  const result = await Payment.aggregate([
    {
      $match: {
        paymentDate: { $gte: start, $lte: end },
        ...extra,
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: result[0]?.total ?? 0, count: result[0]?.count ?? 0 };
}

async function sumExpenses(start: Date, end: Date, extra: Record<string, unknown> = {}) {
  const result = await Expense.aggregate([
    {
      $match: {
        expenseDate: { $gte: start, $lte: end },
        ...extra,
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: result[0]?.total ?? 0, count: result[0]?.count ?? 0 };
}

async function sumPaidPayouts(start: Date, end: Date, extra: Record<string, unknown> = {}) {
  const result = await TeacherPayout.aggregate([
    {
      $match: {
        payoutDate: { $gte: start, $lte: end },
        status: "paid",
        ...extra,
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return { total: result[0]?.total ?? 0, count: result[0]?.count ?? 0 };
}

async function sumPendingPayouts(extra: Record<string, unknown> = {}) {
  const result = await TeacherPayout.aggregate([
    { $match: { status: "pending", ...extra } },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: ["$remaining", "$amount"] } },
        count: { $sum: 1 },
      },
    },
  ]);
  return { total: result[0]?.total ?? 0, count: result[0]?.count ?? 0 };
}

async function getOutstandingStudentBalances() {
  const expectedStudentAgg = await Enrollment.aggregate([
    { $match: { status: { $in: ["approved", "accepted", "pending"] } } },
    {
      $lookup: {
        from: "courses",
        localField: "course",
        foreignField: "_id",
        as: "courseDoc",
      },
    },
    { $unwind: "$courseDoc" },
    { $group: { _id: null, total: { $sum: "$courseDoc.price" } } },
  ]);
  const allPayments = await Payment.aggregate([
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return Math.max(
    0,
    (expectedStudentAgg[0]?.total ?? 0) - (allPayments[0]?.total ?? 0)
  );
}

async function getCashboxSummary() {
  const cashbox = await Cashbox.findOne().lean();
  const { start, end } = getPeriodRange("today");

  const todayAgg = await CashLedger.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: "$direction", total: { $sum: "$amount" } } },
  ]);

  let todayIn = 0;
  let todayOut = 0;
  for (const row of todayAgg) {
    if (row._id === "in") todayIn = row.total;
    if (row._id === "out") todayOut = row.total;
  }

  const currentBalance = cashbox?.currentBalance ?? 0;
  const openingToday = currentBalance - todayIn + todayOut;
  const expectedCash = openingToday + todayIn - todayOut;
  const closure = await DailyCashClosure.findOne({
    dateKey: new Date().toISOString().slice(0, 10),
  })
    .sort({ updatedAt: -1 })
    .lean();

  return {
    openingBalance: cashbox?.openingBalance ?? 0,
    currentBalance,
    openingToday,
    todayIn,
    todayOut,
    expectedCash,
    actualCash: closure?.actualCash ?? null,
    difference: closure?.difference ?? null,
    closure: closure
      ? {
          _id: closure._id.toString(),
          actualCash: closure.actualCash,
          expectedCash: closure.expectedCash,
          difference: closure.difference,
          status: closure.status,
          approvalStatus: closure.approvalStatus,
          note: closure.note ?? "",
          updatedAt: toIso(closure.updatedAt),
        }
      : null,
  };
}

export async function computePeriodStats(period: FinancePeriod) {
  const { start, end } = getPeriodRange(period);
  const [payments, expenses, payouts, pendingPayouts, outstandingStudentBalances] = await Promise.all([
    sumPayments(start, end),
    sumExpenses(start, end),
    sumPaidPayouts(start, end),
    sumPendingPayouts(),
    getOutstandingStudentBalances(),
  ]);
  const totalIncome = payments.total;
  return {
    income: totalIncome,
    expenses: expenses.total,
    paidTeacherPayouts: payouts.total,
    outstandingTeacherBalances: pendingPayouts.total,
    outstandingStudentBalances,
    netProfit: totalIncome - expenses.total - payouts.total,
    paymentCount: payments.count,
  };
}

export async function getFinanceSummary() {
  await connectDB();
  const [today, week, month, year] = await Promise.all([
    computePeriodStats("today"),
    computePeriodStats("week"),
    computePeriodStats("month"),
    computePeriodStats("year"),
  ]);

  const [recentPayments, recentExpenses, recentPayouts, totalPayments, cashbox] = await Promise.all([
    Payment.find()
      .populate("studentId", "name phone")
      .populate("courseId", "title")
      .sort({ paymentDate: -1 })
      .limit(5)
      .lean(),
    Expense.find().sort({ expenseDate: -1 }).limit(5).lean(),
    TeacherPayout.find()
      .populate("teacherId", "name subject")
      .populate("courseId", "title")
      .sort({ payoutDate: -1 })
      .limit(5)
      .lean(),
    Payment.countDocuments(),
    getCashboxSummary(),
  ]);

  return {
    today,
    week,
    month,
    year,
    totalPayments,
    recentPayments: recentPayments.map(formatPayment),
    recentExpenses: recentExpenses.map(formatExpense),
    recentPayouts: recentPayouts.map(formatPayout),
    cashbox,
  };
}

export async function computeReport(params: {
  type: string;
  courseId?: string;
  teacherId?: string;
  paymentMethod?: string;
  from?: string;
  to?: string;
}) {
  await connectDB();

  let start: Date;
  let end: Date;
  const extraPayments: Record<string, unknown> = {};
  const extraExpenses: Record<string, unknown> = {};
  const extraPayouts: Record<string, unknown> = {};

  if (params.type === "daily") {
    ({ start, end } = getPeriodRange("today"));
  } else if (params.type === "weekly") {
    ({ start, end } = getPeriodRange("week"));
  } else if (params.type === "monthly") {
    ({ start, end } = getPeriodRange("month"));
  } else if (params.type === "yearly") {
    ({ start, end } = getPeriodRange("year"));
  } else {
    const range = parseDateRange(params.from, params.to);
    start = range.start ?? getPeriodRange("month").start;
    end = range.end ?? getPeriodRange("month").end;
  }

  if (params.courseId) {
    if (mongoose.Types.ObjectId.isValid(params.courseId)) {
      const courseObjectId = new mongoose.Types.ObjectId(params.courseId);
      extraPayments.courseId = courseObjectId;
      extraPayouts.courseId = courseObjectId;
    }
  }
  if (params.teacherId) {
    if (mongoose.Types.ObjectId.isValid(params.teacherId)) {
      extraPayouts.teacherId = new mongoose.Types.ObjectId(params.teacherId);
    }
  }
  if (params.paymentMethod) {
    extraPayments.paymentMethod = params.paymentMethod;
  }

  const [payments, expenses, payouts, pendingPayouts] = await Promise.all([
    sumPayments(start, end, extraPayments),
    sumExpenses(start, end, extraExpenses),
    sumPaidPayouts(start, end, extraPayouts),
    TeacherPayout.aggregate([
      {
        $match: {
          payoutDate: { $gte: start, $lte: end },
          status: "pending",
          ...extraPayouts,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  const pendingTotal = pendingPayouts[0]?.total ?? 0;
  const pendingCount = pendingPayouts[0]?.count ?? 0;
  const totalIncome = payments.total;
  const outstandingStudentBalances = await getOutstandingStudentBalances();

  return {
    type: params.type,
    from: start.toISOString(),
    to: end.toISOString(),
    totalIncome,
    totalExpenses: expenses.total,
    paidTeacherPayouts: payouts.total,
    pendingTeacherPayouts: pendingTotal,
    outstandingStudentBalances,
    outstandingTeacherBalances: pendingTotal,
    netProfit: totalIncome - expenses.total - payouts.total,
    operationCount: payments.count + expenses.count + payouts.count + pendingCount,
    paymentCount: payments.count,
    expenseCount: expenses.count,
    payoutCount: payouts.count + pendingCount,
  };
}

export function formatPayment(p: unknown) {
  const record = p as Record<string, unknown>;
  const student = record.studentId as { _id?: { toString(): string }; name?: string; phone?: string } | undefined;
  const course = record.courseId as { _id?: { toString(): string }; title?: string } | undefined;
  return {
    _id: (record._id as { toString(): string }).toString(),
    receiptNumber: record.receiptNumber,
    studentId: student?._id?.toString?.() ?? String(record.studentId),
    studentName: student?.name,
    studentPhone: student?.phone,
    courseId: course?._id?.toString?.() ?? String(record.courseId),
    courseTitle: course?.title,
    enrollmentId: record.enrollmentId?.toString?.() ?? record.enrollmentId,
    amount: record.amount,
    paymentMethod: record.paymentMethod,
    paymentDate: toIso(record.paymentDate),
    type: record.type,
    note: record.note,
    createdBy: record.createdBy?.toString?.() ?? record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function formatExpense(e: unknown) {
  const record = e as Record<string, unknown>;
  return {
    _id: (record._id as { toString(): string }).toString(),
    expenseNumber: record.expenseNumber,
    title: record.title,
    amount: record.amount,
    category: record.category,
    expenseDate: toIso(record.expenseDate),
    note: record.note,
    createdBy: record.createdBy?.toString?.() ?? record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function formatPayout(p: unknown) {
  const record = p as Record<string, unknown>;
  const teacher = record.teacherId as { _id?: { toString(): string }; name?: string; subject?: string } | undefined;
  const course = record.courseId as { _id?: { toString(): string }; title?: string } | undefined;
  return {
    _id: (record._id as { toString(): string }).toString(),
    teacherId: teacher?._id?.toString?.() ?? String(record.teacherId),
    teacherName: teacher?.name,
    courseId: course?._id?.toString?.() ?? record.courseId,
    courseTitle: course?.title,
    numberOfSessions: record.numberOfSessions ?? 0,
    extraSessions: record.extraSessions ?? 0,
    sessionRate: record.sessionRate ?? 0,
    manualAdjustment: record.manualAdjustment ?? 0,
    totalDue: record.totalDue ?? record.amount,
    paid: record.paid ?? record.amount,
    remaining: record.remaining ?? 0,
    amount: record.amount,
    payoutType: record.payoutType,
    payoutDate: toIso(record.payoutDate),
    note: record.note,
    status: record.status,
    createdBy: record.createdBy?.toString?.() ?? record.createdBy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

function toIso(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
