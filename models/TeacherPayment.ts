import mongoose, { Schema, type Document, type Model, Types } from "mongoose";
import { round2 } from "@/lib/decimal";

export type TeacherPaymentStatus = "active" | "cancelled";

export interface ITeacherPaymentAllocation {
  invoiceId: Types.ObjectId;
  amount: number;
}

export interface ITeacherPayment extends Document {
  receiptNumber: string;
  teacherId: Types.ObjectId;
  amount: number;
  paymentDate: Date;
  paymentMethod: string;
  accountType: "cash" | "bank";
  accountName?: string;
  referenceNumber?: string;
  notes?: string;
  receiptAttachment?: string;
  allocations: ITeacherPaymentAllocation[];
  grossEarnings: number;
  administrationShare: number;
  teacherNetAmount: number;
  previouslyPaidAmount: number;
  remainingBeforePayment: number;
  remainingAfterPayment: number;
  status: TeacherPaymentStatus;
  cancellationReason?: string;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherPaymentAllocationSchema = new Schema<ITeacherPaymentAllocation>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: "TeacherPayout", required: true },
    amount: { type: Number, required: true, min: 0.01 },
  },
  { _id: false }
);

const TeacherPaymentSchema = new Schema<ITeacherPayment>(
  {
    receiptNumber: { type: String, required: true, unique: true, trim: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, required: true, index: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "baridimob", "bank_transfer", "other"],
      required: true,
    },
    accountType: { type: String, enum: ["cash", "bank"], default: "cash" },
    accountName: { type: String, trim: true },
    referenceNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
    receiptAttachment: { type: String, trim: true },
    allocations: { type: [TeacherPaymentAllocationSchema], default: [] },
    grossEarnings: { type: Number, default: 0, min: 0 },
    administrationShare: { type: Number, default: 0, min: 0 },
    teacherNetAmount: { type: Number, default: 0, min: 0 },
    previouslyPaidAmount: { type: Number, default: 0, min: 0 },
    remainingBeforePayment: { type: Number, default: 0, min: 0 },
    remainingAfterPayment: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
      index: true,
    },
    cancellationReason: { type: String, trim: true },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

TeacherPaymentSchema.pre("validate", async function () {
  this.amount = round2(Number(this.amount || 0));
  this.grossEarnings = round2(Number(this.grossEarnings || 0));
  this.administrationShare = round2(Number(this.administrationShare || 0));
  this.teacherNetAmount = round2(Number(this.teacherNetAmount || 0));
  this.previouslyPaidAmount = round2(Number(this.previouslyPaidAmount || 0));
  this.remainingBeforePayment = round2(Number(this.remainingBeforePayment || 0));
  this.remainingAfterPayment = round2(Number(this.remainingAfterPayment || 0));
  this.allocations = (this.allocations || []).map((allocation) => ({
    invoiceId: allocation.invoiceId,
    amount: round2(Number(allocation.amount || 0)),
  }));

  if (this.receiptNumber) return;
  const date = this.paymentDate ?? new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const count = await TeacherPayment.countDocuments({
    paymentDate: { $gte: start, $lte: end },
  });
  this.receiptNumber = `TPAY-${datePart}-${String(count + 1).padStart(4, "0")}`;
});

TeacherPaymentSchema.index({ teacherId: 1, paymentDate: -1 });
TeacherPaymentSchema.index({ status: 1, paymentDate: -1 });
TeacherPaymentSchema.index({ "allocations.invoiceId": 1 });
TeacherPaymentSchema.index(
  { teacherId: 1, referenceNumber: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      referenceNumber: { $type: "string", $gt: "" },
      status: "active",
    },
  }
);

const TeacherPayment: Model<ITeacherPayment> =
  mongoose.models.TeacherPayment ??
  mongoose.model<ITeacherPayment>("TeacherPayment", TeacherPaymentSchema);

export default TeacherPayment;
