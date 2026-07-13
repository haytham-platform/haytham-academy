import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type KindergartenSubscriptionType = "weekly" | "monthly";
export type KindergartenPaymentStatus = "paid" | "unpaid" | "partially_paid" | "overdue";
export type KindergartenRegistrationStatus = "active" | "suspended" | "withdrawn" | "completed";
export type KindergartenPaymentType = "registration_fee" | "weekly_fee" | "monthly_fee";

export interface IKindergartenPayment {
  _id?: Types.ObjectId;
  paymentType: KindergartenPaymentType;
  billingPeriod?: string;
  amountMinor: number;
  paymentDate: Date;
  paymentMethod: "cash" | "bank_transfer" | "card" | "cheque" | "other";
  receiptNumber: string;
  idempotencyKey?: string;
  cashierId: Types.ObjectId;
  notes?: string;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
}

export interface IKindergartenRegistration extends Document {
  childName: string;
  childId?: Types.ObjectId;
  teacherId: Types.ObjectId;
  guardianName?: string;
  guardianPhone: string;
  registrationDate: Date;
  startDate: Date;
  groupName: string;
  attendanceSchedule: string;
  startTime: string;
  endTime: string;
  registrationFeeMinor: number;
  registrationPaidMinor: number;
  registrationRemainingMinor: number;
  registrationPaymentStatus: KindergartenPaymentStatus;
  subscriptionType: KindergartenSubscriptionType;
  subscriptionPriceMinor: number;
  currentPeriod: string;
  subscriptionPaidMinor: number;
  subscriptionRemainingMinor: number;
  subscriptionPaymentStatus: KindergartenPaymentStatus;
  totalOutstandingMinor: number;
  status: KindergartenRegistrationStatus;
  notes?: string;
  payments: IKindergartenPayment[];
  subscriptionHistory: {
    oldSubscription?: Record<string, unknown>;
    newSubscription: Record<string, unknown>;
    reason: string;
    changedBy: Types.ObjectId;
    changedAt: Date;
  }[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IKindergartenPayment>(
  {
    paymentType: { type: String, enum: ["registration_fee", "weekly_fee", "monthly_fee"], required: true },
    billingPeriod: { type: String, trim: true },
    amountMinor: { type: Number, required: true, min: 0 },
    paymentDate: { type: Date, required: true },
    paymentMethod: { type: String, enum: ["cash", "bank_transfer", "card", "cheque", "other"], default: "cash" },
    receiptNumber: { type: String, required: true },
    idempotencyKey: { type: String, trim: true },
    cashierId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String, trim: true },
  },
  { _id: true, timestamps: true }
);

const SubscriptionHistorySchema = new Schema(
  {
    oldSubscription: { type: Schema.Types.Mixed },
    newSubscription: { type: Schema.Types.Mixed, required: true },
    reason: { type: String, required: true, trim: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const KindergartenRegistrationSchema = new Schema<IKindergartenRegistration>(
  {
    childName: { type: String, required: true, trim: true },
    childId: { type: Schema.Types.ObjectId, ref: "User" },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    guardianName: { type: String, trim: true },
    guardianPhone: { type: String, required: true, trim: true },
    registrationDate: { type: Date, required: true },
    startDate: { type: Date, required: true },
    groupName: { type: String, required: true, trim: true },
    attendanceSchedule: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    registrationFeeMinor: { type: Number, default: 0, min: 0 },
    registrationPaidMinor: { type: Number, default: 0, min: 0 },
    registrationRemainingMinor: { type: Number, default: 0, min: 0 },
    registrationPaymentStatus: { type: String, enum: ["paid", "unpaid", "partially_paid", "overdue"], default: "unpaid" },
    subscriptionType: { type: String, enum: ["weekly", "monthly"], required: true },
    subscriptionPriceMinor: { type: Number, default: 0, min: 0 },
    currentPeriod: { type: String, required: true, trim: true },
    subscriptionPaidMinor: { type: Number, default: 0, min: 0 },
    subscriptionRemainingMinor: { type: Number, default: 0, min: 0 },
    subscriptionPaymentStatus: { type: String, enum: ["paid", "unpaid", "partially_paid", "overdue"], default: "unpaid" },
    totalOutstandingMinor: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "suspended", "withdrawn", "completed"], default: "active" },
    notes: { type: String, trim: true },
    payments: [PaymentSchema],
    subscriptionHistory: [SubscriptionHistorySchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

KindergartenRegistrationSchema.index({ childName: "text", guardianPhone: "text", groupName: "text" });
KindergartenRegistrationSchema.index({ teacherId: 1, startDate: 1, startTime: 1, endTime: 1, status: 1 });
KindergartenRegistrationSchema.index({ childName: 1, startDate: 1, startTime: 1, endTime: 1, status: 1 });
KindergartenRegistrationSchema.index({ childName: 1, subscriptionType: 1, currentPeriod: 1, deletedAt: 1 }, { unique: true });
KindergartenRegistrationSchema.index({ "payments.receiptNumber": 1 }, { unique: true, sparse: true });

const KindergartenRegistration: Model<IKindergartenRegistration> =
  mongoose.models.KindergartenRegistration ??
  mongoose.model<IKindergartenRegistration>("KindergartenRegistration", KindergartenRegistrationSchema);

export default KindergartenRegistration;
