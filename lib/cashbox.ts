import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Cashbox from "@/models/Cashbox";
import CashLedger, {
  type LedgerDirection,
  type LedgerSourceType,
  type LedgerType,
} from "@/models/CashLedger";
import { getPeriodRange, validateAmount } from "@/lib/finance";

interface LedgerParams {
  type: LedgerType;
  amount: number;
  direction: LedgerDirection;
  sourceType: LedgerSourceType;
  sourceId?: string;
  description: string;
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
    { upsert: true, new: false, setDefaultsOnInsert: true }
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
      description: params.description,
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
  });
}

export async function recordPaymentIn(
  paymentId: string,
  amount: number,
  description: string,
  createdBy: string
) {
  return recordLedgerEntry({
    type: "income",
    amount,
    direction: "in",
    sourceType: "payment",
    sourceId: paymentId,
    description,
    createdBy,
  });
}

export async function recordExpenseOut(
  expenseId: string,
  amount: number,
  description: string,
  createdBy: string
) {
  return recordLedgerEntry({
    type: "expense",
    amount,
    direction: "out",
    sourceType: "expense",
    sourceId: expenseId,
    description,
    createdBy,
  });
}

export async function recordPayoutOut(
  payoutId: string,
  amount: number,
  description: string,
  createdBy: string
) {
  return recordLedgerEntry({
    type: "teacher_payout",
    amount,
    direction: "out",
    sourceType: "teacher_payout",
    sourceId: payoutId,
    description,
    createdBy,
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
  description: string;
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
    description: entry.description,
    balanceBefore: entry.balanceBefore,
    balanceAfter: entry.balanceAfter,
    createdBy:
      typeof entry.createdBy === "string"
        ? entry.createdBy
        : entry.createdBy.toString(),
    createdAt: entry.createdAt,
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

  return {
    openingBalance: cashbox.openingBalance,
    currentBalance: cashbox.currentBalance,
    currency: cashbox.currency,
    openingToday,
    todayIn,
    todayOut,
    netToday,
    updatedAt: cashbox.updatedAt,
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
