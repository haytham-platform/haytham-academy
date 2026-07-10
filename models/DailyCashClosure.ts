import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type CashClosureStatus = "balanced" | "shortage" | "overage";
export type CashClosureApprovalStatus = "pending" | "approved" | "rejected";

export interface IDailyCashClosure extends Document {
  dateKey: string;
  expectedCash: number;
  actualCash: number;
  difference: number;
  status: CashClosureStatus;
  approvalStatus: CashClosureApprovalStatus;
  note?: string;
  enteredBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DailyCashClosureSchema = new Schema<IDailyCashClosure>(
  {
    dateKey: { type: String, required: true, unique: true, index: true },
    expectedCash: { type: Number, required: true },
    actualCash: { type: Number, required: true },
    difference: { type: Number, required: true },
    status: {
      type: String,
      enum: ["balanced", "shortage", "overage"],
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    note: { type: String, trim: true },
    enteredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

const DailyCashClosure: Model<IDailyCashClosure> =
  mongoose.models.DailyCashClosure ??
  mongoose.model<IDailyCashClosure>("DailyCashClosure", DailyCashClosureSchema);

export default DailyCashClosure;
