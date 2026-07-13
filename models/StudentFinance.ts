import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type StudentFinancialStatus =
  | "paid"
  | "partially_paid"
  | "unpaid"
  | "overdue"
  | "exempted"
  | "refunded"
  | "cancelled";

export type StudentFeeType =
  | "registration"
  | "course"
  | "academic_level"
  | "private_lesson"
  | "kindergarten"
  | "transportation"
  | "books_materials"
  | "exam"
  | "certificate"
  | "other";

export type StudentChargeStatus =
  | "pending"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "exempted"
  | "refunded";

export type StudentPaymentMethod =
  | "cash"
  | "bank_transfer"
  | "card"
  | "online_payment"
  | "baridimob"
  | "other";

export type StudentPaymentStatus = "completed" | "pending" | "cancelled" | "refunded";

export type StudentDiscountType =
  | "fixed"
  | "percentage"
  | "full_exemption"
  | "partial_exemption"
  | "scholarship"
  | "sibling"
  | "promotional"
  | "manual";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type InstallmentStatus = "active" | "completed" | "cancelled" | "defaulted";

export type DebtStatus = "open" | "in_collection" | "resolved" | "cancelled";

export type RefundStatus = "pending" | "approved" | "processed" | "rejected" | "cancelled";

export interface IStudentFeeConfig extends Document {
  name: string;
  type: StudentFeeType;
  amountMinor: number;
  academicLevel?: string;
  courseId?: Types.ObjectId;
  season?: string;
  effectiveDate: Date;
  expirationDate?: Date;
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentCharge extends Document {
  studentId: Types.ObjectId;
  enrollmentId?: Types.ObjectId;
  courseId?: Types.ObjectId;
  academicSeason?: string;
  chargeType: StudentFeeType;
  description: string;
  originalAmountMinor: number;
  discountAmountMinor: number;
  finalAmountMinor: number;
  paidAmountMinor: number;
  refundedAmountMinor: number;
  balanceMinor: number;
  dueDate: Date;
  status: StudentChargeStatus;
  relatedRecordType?: string;
  relatedRecordId?: Types.ObjectId;
  duplicateKey?: string;
  allowDuplicate: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentPaymentAllocation {
  chargeId: Types.ObjectId;
  amountMinor: number;
}

export interface IStudentPayment extends Document {
  studentId: Types.ObjectId;
  amountMinor: number;
  paymentDate: Date;
  paymentMethod: StudentPaymentMethod;
  paymentReference?: string;
  receiptNumber: string;
  allocations: IStudentPaymentAllocation[];
  academicSeason?: string;
  notes?: string;
  receivedBy: Types.ObjectId;
  status: StudentPaymentStatus;
  idempotencyKey?: string;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
  refundedAmountMinor: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentInstallmentItem {
  dueDate: Date;
  amountMinor: number;
  paidAmountMinor: number;
  status: "pending" | "paid" | "late" | "cancelled";
}

export interface IStudentInstallmentPlan extends Document {
  studentId: Types.ObjectId;
  chargeIds: Types.ObjectId[];
  totalAmountMinor: number;
  numberOfInstallments: number;
  installmentAmountMinor: number;
  installments: IStudentInstallmentItem[];
  paidAmountMinor: number;
  remainingAmountMinor: number;
  status: InstallmentStatus;
  lateStatus: "current" | "late";
  academicSeason?: string;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentDiscount extends Document {
  studentId: Types.ObjectId;
  chargeId?: Types.ObjectId;
  type: StudentDiscountType;
  valueMinor?: number;
  percentage?: number;
  appliedAmountMinor: number;
  reason: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: Types.ObjectId;
  effectiveDate: Date;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentDebt extends Document {
  studentId: Types.ObjectId;
  chargeId: Types.ObjectId;
  originalDueDate: Date;
  outstandingAmountMinor: number;
  daysOverdue: number;
  paymentReminders: number;
  status: DebtStatus;
  collectionNotes?: string;
  lastFollowUpDate?: Date;
  responsibleUser?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentRefund extends Document {
  studentId: Types.ObjectId;
  originalPaymentId: Types.ObjectId;
  refundAmountMinor: number;
  reason: string;
  refundDate: Date;
  refundMethod: StudentPaymentMethod;
  approvedBy: Types.ObjectId;
  processedBy: Types.ObjectId;
  status: RefundStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentFinancialNote extends Document {
  studentId: Types.ObjectId;
  note: string;
  author: Types.ObjectId;
  visibility: "internal" | "restricted";
  createdAt: Date;
  updatedAt: Date;
}

const moneyField = { type: Number, required: true, min: 0, validate: Number.isInteger };

const StudentFeeConfigSchema = new Schema<IStudentFeeConfig>(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
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
      ],
      required: true,
    },
    amountMinor: moneyField,
    academicLevel: { type: String, trim: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    season: { type: String, trim: true },
    effectiveDate: { type: Date, required: true },
    expirationDate: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const StudentChargeSchema = new Schema<IStudentCharge>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment" },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    academicSeason: { type: String, trim: true },
    chargeType: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    originalAmountMinor: moneyField,
    discountAmountMinor: { ...moneyField, default: 0 },
    finalAmountMinor: moneyField,
    paidAmountMinor: { ...moneyField, default: 0 },
    refundedAmountMinor: { ...moneyField, default: 0 },
    balanceMinor: moneyField,
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "partially_paid", "paid", "overdue", "cancelled", "exempted", "refunded"],
      default: "pending",
    },
    relatedRecordType: { type: String, trim: true },
    relatedRecordId: { type: Schema.Types.ObjectId },
    duplicateKey: { type: String, trim: true },
    allowDuplicate: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

const PaymentAllocationSchema = new Schema<IStudentPaymentAllocation>(
  {
    chargeId: { type: Schema.Types.ObjectId, ref: "StudentCharge", required: true },
    amountMinor: moneyField,
  },
  { _id: false }
);

const StudentPaymentSchema = new Schema<IStudentPayment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amountMinor: moneyField,
    paymentDate: { type: Date, required: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "card", "online_payment", "baridimob", "other"],
      required: true,
    },
    paymentReference: { type: String, trim: true },
    receiptNumber: { type: String, required: true, unique: true, trim: true },
    allocations: { type: [PaymentAllocationSchema], default: [] },
    academicSeason: { type: String, trim: true },
    notes: { type: String, trim: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["completed", "pending", "cancelled", "refunded"],
      default: "completed",
    },
    idempotencyKey: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String, trim: true },
    refundedAmountMinor: { ...moneyField, default: 0 },
  },
  { timestamps: true }
);

const InstallmentItemSchema = new Schema<IStudentInstallmentItem>(
  {
    dueDate: { type: Date, required: true },
    amountMinor: moneyField,
    paidAmountMinor: { ...moneyField, default: 0 },
    status: { type: String, enum: ["pending", "paid", "late", "cancelled"], default: "pending" },
  },
  { _id: false }
);

const StudentInstallmentPlanSchema = new Schema<IStudentInstallmentPlan>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    chargeIds: [{ type: Schema.Types.ObjectId, ref: "StudentCharge" }],
    totalAmountMinor: moneyField,
    numberOfInstallments: { type: Number, required: true, min: 1, validate: Number.isInteger },
    installmentAmountMinor: moneyField,
    installments: { type: [InstallmentItemSchema], default: [] },
    paidAmountMinor: { ...moneyField, default: 0 },
    remainingAmountMinor: moneyField,
    status: { type: String, enum: ["active", "completed", "cancelled", "defaulted"], default: "active" },
    lateStatus: { type: String, enum: ["current", "late"], default: "current" },
    academicSeason: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const StudentDiscountSchema = new Schema<IStudentDiscount>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    chargeId: { type: Schema.Types.ObjectId, ref: "StudentCharge" },
    type: { type: String, required: true },
    valueMinor: { type: Number, min: 0, validate: { validator: Number.isInteger } },
    percentage: { type: Number, min: 0, max: 100 },
    appliedAmountMinor: { ...moneyField, default: 0 },
    reason: { type: String, required: true, trim: true },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    effectiveDate: { type: Date, required: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const StudentDebtSchema = new Schema<IStudentDebt>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    chargeId: { type: Schema.Types.ObjectId, ref: "StudentCharge", required: true },
    originalDueDate: { type: Date, required: true },
    outstandingAmountMinor: moneyField,
    daysOverdue: { type: Number, default: 0, min: 0 },
    paymentReminders: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["open", "in_collection", "resolved", "cancelled"], default: "open" },
    collectionNotes: { type: String, trim: true },
    lastFollowUpDate: { type: Date },
    responsibleUser: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const StudentRefundSchema = new Schema<IStudentRefund>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    originalPaymentId: { type: Schema.Types.ObjectId, ref: "StudentPayment", required: true },
    refundAmountMinor: moneyField,
    reason: { type: String, required: true, trim: true },
    refundDate: { type: Date, required: true },
    refundMethod: { type: String, enum: ["cash", "bank_transfer", "card", "online_payment", "baridimob", "other"], required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    processedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "approved", "processed", "rejected", "cancelled"], default: "processed" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

const StudentFinancialNoteSchema = new Schema<IStudentFinancialNote>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, required: true, trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    visibility: { type: String, enum: ["internal", "restricted"], default: "internal" },
  },
  { timestamps: true }
);

StudentFeeConfigSchema.index({ type: 1, academicLevel: 1, courseId: 1, season: 1, isActive: 1 });
StudentFeeConfigSchema.index({ effectiveDate: 1, expirationDate: 1 });

StudentChargeSchema.index({ duplicateKey: 1, status: 1 });
StudentChargeSchema.index({ studentId: 1, status: 1, dueDate: 1 });
StudentChargeSchema.index({ courseId: 1, academicSeason: 1 });
StudentChargeSchema.index({ enrollmentId: 1 });

StudentPaymentSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true }
);
StudentPaymentSchema.index({ studentId: 1, paymentDate: -1 });
StudentPaymentSchema.index({ paymentMethod: 1, paymentDate: -1 });
StudentPaymentSchema.index({ academicSeason: 1, paymentDate: -1 });

StudentInstallmentPlanSchema.index(
  { studentId: 1, academicSeason: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);
StudentDiscountSchema.index({ studentId: 1, chargeId: 1, approvalStatus: 1 });
StudentDebtSchema.index({ chargeId: 1 }, { unique: true });
StudentDebtSchema.index({ studentId: 1, status: 1, originalDueDate: 1 });
StudentRefundSchema.index({ originalPaymentId: 1, status: 1 });
StudentFinancialNoteSchema.index({ studentId: 1, createdAt: -1 });

export const StudentFeeConfig: Model<IStudentFeeConfig> =
  mongoose.models.StudentFeeConfig ??
  mongoose.model<IStudentFeeConfig>("StudentFeeConfig", StudentFeeConfigSchema);

export const StudentCharge: Model<IStudentCharge> =
  mongoose.models.StudentCharge ??
  mongoose.model<IStudentCharge>("StudentCharge", StudentChargeSchema);

export const StudentPayment: Model<IStudentPayment> =
  mongoose.models.StudentPayment ??
  mongoose.model<IStudentPayment>("StudentPayment", StudentPaymentSchema);

export const StudentInstallmentPlan: Model<IStudentInstallmentPlan> =
  mongoose.models.StudentInstallmentPlan ??
  mongoose.model<IStudentInstallmentPlan>("StudentInstallmentPlan", StudentInstallmentPlanSchema);

export const StudentDiscount: Model<IStudentDiscount> =
  mongoose.models.StudentDiscount ??
  mongoose.model<IStudentDiscount>("StudentDiscount", StudentDiscountSchema);

export const StudentDebt: Model<IStudentDebt> =
  mongoose.models.StudentDebt ??
  mongoose.model<IStudentDebt>("StudentDebt", StudentDebtSchema);

export const StudentRefund: Model<IStudentRefund> =
  mongoose.models.StudentRefund ??
  mongoose.model<IStudentRefund>("StudentRefund", StudentRefundSchema);

export const StudentFinancialNote: Model<IStudentFinancialNote> =
  mongoose.models.StudentFinancialNote ??
  mongoose.model<IStudentFinancialNote>("StudentFinancialNote", StudentFinancialNoteSchema);
