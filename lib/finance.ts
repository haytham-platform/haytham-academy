import Payment from "@/models/Payment";
import Expense from "@/models/Expense";
import TeacherPayout from "@/models/TeacherPayout";
import { connectDB } from "@/lib/db";

export type FinancePeriod = "today" | "month" | "year";

export function getPeriodRange(period: FinancePeriod, refDate = new Date()) {
  const start = new Date(refDate);
  const end = new Date(refDate);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
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

export async function computePeriodStats(period: FinancePeriod) {
  const { start, end } = getPeriodRange(period);
  const [payments, expenses, payouts] = await Promise.all([
    sumPayments(start, end),
    sumExpenses(start, end),
    sumPaidPayouts(start, end),
  ]);
  const totalIncome = payments.total;
  return {
    income: totalIncome,
    expenses: expenses.total,
    paidTeacherPayouts: payouts.total,
    netProfit: totalIncome - expenses.total - payouts.total,
    paymentCount: payments.count,
  };
}

export async function getFinanceSummary() {
  await connectDB();
  const [today, month, year] = await Promise.all([
    computePeriodStats("today"),
    computePeriodStats("month"),
    computePeriodStats("year"),
  ]);

  const [recentPayments, recentExpenses, recentPayouts, totalPayments] = await Promise.all([
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
  ]);

  return {
    today,
    month,
    year,
    totalPayments,
    recentPayments: recentPayments.map(formatPayment),
    recentExpenses: recentExpenses.map(formatExpense),
    recentPayouts: recentPayouts.map(formatPayout),
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
    extraPayments.courseId = params.courseId;
    extraPayouts.courseId = params.courseId;
  }
  if (params.teacherId) {
    extraPayouts.teacherId = params.teacherId;
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

  return {
    type: params.type,
    from: start,
    to: end,
    totalIncome,
    totalExpenses: expenses.total,
    paidTeacherPayouts: payouts.total,
    pendingTeacherPayouts: pendingTotal,
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
    studentId: student?._id?.toString?.() ?? String(record.studentId),
    studentName: student?.name,
    studentPhone: student?.phone,
    courseId: course?._id?.toString?.() ?? String(record.courseId),
    courseTitle: course?.title,
    enrollmentId: record.enrollmentId?.toString?.() ?? record.enrollmentId,
    amount: record.amount,
    paymentMethod: record.paymentMethod,
    paymentDate: record.paymentDate,
    type: record.type,
    note: record.note,
    createdBy: record.createdBy?.toString?.() ?? record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function formatExpense(e: unknown) {
  const record = e as Record<string, unknown>;
  return {
    _id: (record._id as { toString(): string }).toString(),
    title: record.title,
    amount: record.amount,
    category: record.category,
    expenseDate: record.expenseDate,
    note: record.note,
    createdBy: record.createdBy?.toString?.() ?? record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
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
    amount: record.amount,
    payoutType: record.payoutType,
    payoutDate: record.payoutDate,
    note: record.note,
    status: record.status,
    createdBy: record.createdBy?.toString?.() ?? record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
