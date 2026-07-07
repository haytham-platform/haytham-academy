import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type LedgerType = "income" | "expense" | "teacher_payout" | "adjustment";
export type LedgerDirection = "in" | "out";
export type LedgerSourceType =
  | "payment"
  | "expense"
  | "teacher_payout"
  | "manual_adjustment"
  | "transport_payment";

export interface ICashLedger extends Document {
  type: LedgerType;
  amount: number;
  direction: LedgerDirection;
  sourceType: LedgerSourceType;
  sourceId?: Types.ObjectId;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const CashLedgerSchema = new Schema<ICashLedger>(
  {
    type: {
      type: String,
      enum: ["income", "expense", "teacher_payout", "adjustment"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    direction: { type: String, enum: ["in", "out"], required: true },
    sourceType: {
      type: String,
      enum: ["payment", "expense", "teacher_payout", "manual_adjustment", "transport_payment"],
      required: true,
    },
    sourceId: { type: Schema.Types.ObjectId },
    description: { type: String, required: true, trim: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CashLedgerSchema.index({ createdAt: -1 });
CashLedgerSchema.index({ sourceType: 1, sourceId: 1 });
CashLedgerSchema.index({ type: 1 });

if (process.env.NODE_ENV === "development" && mongoose.models.CashLedger) {
  delete mongoose.models.CashLedger;
}

const CashLedger: Model<ICashLedger> =
  mongoose.models.CashLedger ??
  mongoose.model<ICashLedger>("CashLedger", CashLedgerSchema);

export default CashLedger;
