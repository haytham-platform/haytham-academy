import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Cashbox from "@/models/Cashbox";
import DailyCashClosure from "@/models/DailyCashClosure";
import CashLedger, {
  type LedgerDirection,
  type LedgerSourceType,
  type LedgerStatus,
  type LedgerType,
} from "@/models/CashLedger";
import { getPeriodRange, validateAmount } from "@/lib/finance";
import { notifyFinance } from "@/lib/notifications";
import { recordFinancialAudit } from "@/lib/audit";

interface LedgerParams {
  type: LedgerType;
  amount: number;
  direction: LedgerDirection;
  sourceType: LedgerSourceType;
  sourceId?: string;
  category?: string;
  description: string;
  studentId?: string;
  teacherId?: string;
  courseId?: string;
  paymentMethod?: string;
  status?: LedgerStatus;
  notes?: string;
  createdBy: string;
}

export async function getOrCreateCashbox(updatedBy?: string) {
  await connectDB();
  let cashbox = await Cashbox.findOne();
  if (!cashbox) {
    cashbox = await Cashbox.create({
      openingBalance: 0,
      currentBalance: 0,
      currency: "DZD",
      updatedBy,
    });
  }
  return cashbox;
}

export async function recordLedgerEntry(params: LedgerParams) {
  const amount = validateAmount(params.amount);
  if (!amount) throw new Error("المبلغ يجب أن يكون أكبر من صفر");

  await connectDB();

  const delta = params.direction === "in" ? amount : -amount;
  const updatedBy = new mongoose.Types.ObjectId(params.createdBy);

  const cashbox = await Cashbox.findOneAndUpdate(
    {},
    {
      $inc: { currentBalance: delta },
      $set: { updatedBy },
      $setOnInsert: { openingBalance: 0, currency: "DZD" },
    },
    { upsert: true, returnDocument: "before", setDefaultsOnInsert: true }
  );

  const balanceBefore = cashbox?.currentBalance ?? 0;
  const balanceAfter = balanceBefore + delta;

  const [entry] = await CashLedger.create([
    {
      type: params.type,
      amount,
      direction: params.direction,
      sourceType: params.sourceType,
      sourceId: params.sourceId || undefined,
      category: params.category,
      description: params.description,
      studentId: params.studentId || undefined,
      teacherId: params.teacherId || undefined,
      courseId: params.courseId || undefined,
      paymentMethod: params.paymentMethod,
      status: params.status ?? "posted",
      notes: params.notes,
      balanceBefore,
      balanceAfter,
      createdBy: params.createdBy,
    },
  ]);

  return { entry, cashbox: await Cashbox.findOne() };
}

export async function reverseSourceEntry(
  sourceType: LedgerSourceType,
  sourceId: string,
  amount: number,
  description: string,
  createdBy: string,
  originalDirection: LedgerDirection
) {
  const reverseDirection: LedgerDirection =
    originalDirection === "in" ? "out" : "in";

  const typeMap: Record<LedgerSourceType, LedgerType> = {
    payment: "income",
    expense: "expense",
    teacher_payout: "teacher_payout",
    manual_adjustment: "adjustment",
    transport_payment: "income",
  };

  return recordLedgerEntry({
    type: typeMap[sourceType],
    amount,
    direction: reverseDirection,
    sourceType,
    sourceId,
    description,
    createdBy,
    status: "reversed",
  });
}

export async function recordPaymentIn(
  paymentId: string,
  amount: number,
  description: string,
  createdBy: string,
  metadata: Partial<Pick<LedgerParams, "studentId" | "courseId" | "paymentMethod" | "notes">> = {}
) {
  return recordLedgerEntry({
    type: "income",
    amount,
    direction: "in",
    sourceType: "payment",
    sourceId: paymentId,
    category: "student_payment",
    description,
    createdBy,
    ...metadata,
  });
}

export async function recordExpenseOut(
  expenseId: string,
  amount: number,
  description: string,
  createdBy: string,
  metadata: Partial<Pick<LedgerParams, "category" | "notes">> = {}
) {
  return recordLedgerEntry({
    type: "expense",
    amount,
    direction: "out",
    sourceType: "expense",
    sourceId: expenseId,
    category: metadata.category ?? "expense",
    description,
    createdBy,
    notes: metadata.notes,
  });
}

export async function recordPayoutOut(
  payoutId: string,
  amount: number,
  description: string,
  createdBy: string,
  metadata: Partial<Pick<LedgerParams, "teacherId" | "courseId" | "paymentMethod" | "notes">> = {}
) {
  return recordLedgerEntry({
    type: "teacher_payout",
    amount,
    direction: "out",
    sourceType: "teacher_payout",
    sourceId: payoutId,
    category: "teacher_salary",
    description,
    createdBy,
    ...metadata,
  });
}

export async function recordManualAdjustment(
  amount: number,
  direction: LedgerDirection,
  reason: string,
  createdBy: string
) {
  return recordLedgerEntry({
    type: "adjustment",
    amount,
    direction,
    sourceType: "manual_adjustment",
    category: "manual_adjustment",
    description: reason,
    createdBy,
  });
}

export function formatLedgerEntry(entry: {
  _id: { toString(): string };
  type: string;
  amount: number;
  direction: string;
  sourceType: string;
  sourceId?: { toString(): string };
  category?: string;
  description: string;
  studentId?: { toString(): string };
  teacherId?: { toString(): string };
  courseId?: { toString(): string };
  paymentMethod?: string;
  status?: string;
  notes?: string;
  balanceBefore: number;
  balanceAfter: number;
  createdBy: { toString(): string } | string;
  createdAt: Date;
}) {
  return {
    _id: entry._id.toString(),
    type: entry.type,
    amount: entry.amount,
    direction: entry.direction,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId?.toString?.(),
    category: entry.category,
    description: entry.description,
    studentId: entry.studentId?.toString?.(),
    teacherId: entry.teacherId?.toString?.(),
    courseId: entry.courseId?.toString?.(),
    paymentMethod: entry.paymentMethod,
    status: entry.status ?? "posted",
    notes: entry.notes,
    balanceBefore: entry.balanceBefore,
    balanceAfter: entry.balanceAfter,
    createdBy:
      typeof entry.createdBy === "string"
        ? entry.createdBy
        : entry.createdBy.toString(),
    createdAt: toIso(entry.createdAt),
  };
}

export async function getCashboxOverview() {
  await connectDB();
  const cashbox = await getOrCreateCashbox();
  const { start, end } = getPeriodRange("today");

  const todayAgg = await CashLedger.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: "$direction",
        total: { $sum: "$amount" },
      },
    },
  ]);

  let todayIn = 0;
  let todayOut = 0;
  for (const row of todayAgg) {
    if (row._id === "in") todayIn = row.total;
    if (row._id === "out") todayOut = row.total;
  }

  const openingToday = cashbox.currentBalance - todayIn + todayOut;
  const netToday = todayIn - todayOut;
  const latestClosure = await DailyCashClosure.findOne({ dateKey: dateKey() })
    .sort({ updatedAt: -1 })
    .lean();

  return {
    openingBalance: cashbox.openingBalance,
    currentBalance: cashbox.currentBalance,
    currency: cashbox.currency,
    openingToday,
    todayIn,
    todayOut,
    netToday,
    expectedCashToday: openingToday + netToday,
    closure: latestClosure
      ? {
          _id: latestClosure._id.toString(),
          actualCash: latestClosure.actualCash,
          expectedCash: latestClosure.expectedCash,
          difference: latestClosure.difference,
          status: latestClosure.status,
          approvalStatus: latestClosure.approvalStatus,
          note: latestClosure.note ?? "",
          updatedAt: toIso(latestClosure.updatedAt),
        }
      : null,
    updatedAt: toIso(cashbox.updatedAt),
  };
}

export async function getCashLedger(filters: {
  type?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  await connectDB();
  const query: Record<string, unknown> = {};

  if (filters.type) query.type = filters.type;

  if (filters.from || filters.to) {
    const dateFilter: Record<string, Date> = {};
    if (filters.from) dateFilter.$gte = new Date(filters.from);
    if (filters.to) {
      const end = new Date(filters.to);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    query.createdAt = dateFilter;
  }

  const entries = await CashLedger.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit ?? 100)
    .lean();

  return entries.map((e) =>
    formatLedgerEntry(e as Parameters<typeof formatLedgerEntry>[0])
  );
}

export function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function cashDifferenceStatus(difference: number) {
  if (difference === 0) return "balanced";
  return difference < 0 ? "shortage" : "overage";
}

export async function closeDailyCash(params: {
  actualCash: number;
  note?: string;
  enteredBy: string;
}) {
  const actualCash = Number(params.actualCash);
  if (!Number.isFinite(actualCash) || actualCash < 0) {
    throw new Error("المبلغ الفعلي غير صالح");
  }

  const overview = await getCashboxOverview();
  const expectedCash = overview.expectedCashToday;
  const difference = actualCash - expectedCash;
  const status = cashDifferenceStatus(difference);

  const closure = await DailyCashClosure.findOneAndUpdate(
    { dateKey: dateKey() },
    {
      expectedCash,
      actualCash,
      difference,
      status,
      approvalStatus: "pending",
      note: params.note?.trim() || "",
      enteredBy: params.enteredBy,
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  await notifyFinance({
    title: "تم إغلاق الصندوق اليومي",
    message: `تم إدخال النقد الفعلي: ${actualCash}. الفرق: ${difference}.`,
    type: status === "balanced" ? "success" : "warning",
    createdBy: params.enteredBy,
    data: {
      expectedCash,
      actualCash,
      difference,
      status,
      closureId: closure._id.toString(),
    },
  });

  if (difference !== 0) {
    await notifyFinance({
      title: "فرق في الصندوق",
      message: `النقد الفعلي لا يطابق المتوقع. الفرق: ${difference}.`,
      type: "warning",
      createdBy: params.enteredBy,
      data: {
        expectedCash,
        actualCash,
        difference,
        status,
        closureId: closure._id.toString(),
      },
    });
  }

  await recordFinancialAudit({
    userId: params.enteredBy,
    action: "cashbox.close",
    recordType: "daily_cash_closure",
    recordId: closure._id.toString(),
    metadata: {
      expectedCash,
      actualCash,
      difference,
      status,
    },
  });

  return closure;
}

export async function reviewDailyCashClosure(params: {
  closureId: string;
  approvalStatus: "approved" | "rejected";
  reviewedBy: string;
}) {
  const closure = await DailyCashClosure.findByIdAndUpdate(
    params.closureId,
    {
      approvalStatus: params.approvalStatus,
      reviewedBy: params.reviewedBy,
      reviewedAt: new Date(),
    },
    { returnDocument: "after" }
  );
  if (!closure) throw new Error("إغلاق الصندوق غير موجود");
  await recordFinancialAudit({
    userId: params.reviewedBy,
    action: "cashbox.review",
    recordType: "daily_cash_closure",
    recordId: params.closureId,
    metadata: {
      approvalStatus: params.approvalStatus,
    },
  });
  return closure;
}

function toIso(value: Date | string | undefined | null) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
