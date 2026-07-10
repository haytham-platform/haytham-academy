import mongoose, { Schema, type Document, type Model, Types } from "mongoose";
import { round2 } from "@/lib/decimal";

export type PayoutType = "fixed" | "percentage" | "per_session" | "other";
export type PayoutStatus = "pending" | "paid";
export type TeacherInvoicePaymentStatus = "unpaid" | "partial" | "paid";
export type TeacherPayoutRecordType = "payout" | "teacher_invoice";
export type TeacherInvoiceStatus = "active" | "cancelled";

export interface ITeacherPayout extends Document {
  teacherId: Types.ObjectId;
  courseId?: Types.ObjectId;
  recordType: TeacherPayoutRecordType;
  academicSeason?: string;
  invoicePeriod?: string;
  completedSessionIds: Types.ObjectId[];
  numberOfSessions: number;
  extraSessions: number;
  sessionRate: number;
  grossAmount: number;
  administrationPercentage: number;
  teacherPercentage: number;
  administrationShare: number;
  teacherShareAmount: number;
  deductions: number;
  netTeacherAmount: number;
  manualAdjustment: number;
  totalDue: number;
  paid: number;
  remaining: number;
  amount: number;
  payoutType: PayoutType;
  payoutDate: Date;
  paymentDate?: Date;
  paymentMethod?: string;
  paymentStatus: TeacherInvoicePaymentStatus;
  invoiceStatus: TeacherInvoiceStatus;
  note?: string;
  status: PayoutStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherPayoutSchema = new Schema<ITeacherPayout>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    recordType: {
      type: String,
      enum: ["payout", "teacher_invoice"],
      default: "payout",
    },
    academicSeason: { type: String, trim: true },
    invoicePeriod: { type: String, trim: true },
    completedSessionIds: [{ type: Schema.Types.ObjectId, ref: "LessonInvoice" }],
    numberOfSessions: { type: Number, default: 0, min: 0 },
    extraSessions: { type: Number, default: 0, min: 0 },
    sessionRate: { type: Number, default: 0, min: 0 },
    grossAmount: { type: Number, default: 0, min: 0 },
    administrationPercentage: { type: Number, default: 0, min: 0, max: 100 },
    teacherPercentage: { type: Number, default: 100, min: 0, max: 100 },
    administrationShare: { type: Number, default: 0, min: 0 },
    teacherShareAmount: { type: Number, default: 0, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    netTeacherAmount: { type: Number, default: 0, min: 0 },
    manualAdjustment: { type: Number, default: 0 },
    totalDue: { type: Number, default: 0, min: 0 },
    paid: { type: Number, default: 0, min: 0 },
    remaining: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    payoutType: {
      type: String,
      enum: ["fixed", "percentage", "per_session", "other"],
      default: "fixed",
    },
    payoutDate: { type: Date, required: true },
    paymentDate: { type: Date },
    paymentMethod: { type: String, trim: true },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },
    invoiceStatus: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
    },
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

TeacherPayoutSchema.pre("validate", function () {
  const sessions = Number(this.numberOfSessions || 0) + Number(this.extraSessions || 0);
  const computedGrossAmount = round2(sessions * Number(this.sessionRate || 0));
  const grossAmount =
    this.recordType === "teacher_invoice"
      ? computedGrossAmount
      : Number(this.grossAmount || 0) > 0
        ? Number(this.grossAmount)
        : computedGrossAmount;
  const administrationPercentage = Number(this.administrationPercentage || 0);
  const teacherPercentage =
    Number(this.teacherPercentage || 0) > 0 ? Number(this.teacherPercentage) : Math.max(0, 100 - administrationPercentage);
  const deductions = round2(Number(this.deductions || 0));
  const manualAdjustment = round2(Number(this.manualAdjustment || 0));
  const computedAdministrationShare = round2((grossAmount * administrationPercentage) / 100);
  const administrationShare =
    this.recordType === "teacher_invoice"
      ? computedAdministrationShare
      : Number(this.administrationShare || 0) > 0
        ? Number(this.administrationShare)
        : computedAdministrationShare;
  const computedTeacherShareAmount = round2((grossAmount * teacherPercentage) / 100);
  const teacherShareAmount =
    this.recordType === "teacher_invoice"
      ? computedTeacherShareAmount
      : Number(this.teacherShareAmount || 0) > 0
        ? Number(this.teacherShareAmount)
        : computedTeacherShareAmount;
  const computedNetTeacherAmount = round2(Math.max(
    0,
    teacherShareAmount - deductions + manualAdjustment
  ));
  const netTeacherAmount =
    this.recordType === "teacher_invoice"
      ? computedNetTeacherAmount
      : Number(this.netTeacherAmount || 0) > 0
        ? Number(this.netTeacherAmount)
        : computedNetTeacherAmount;
  const calculatedDue =
    this.recordType === "teacher_invoice"
      ? netTeacherAmount
      : round2(sessions * Number(this.sessionRate || 0) + manualAdjustment);
  const totalDue = round2(Number(this.totalDue || 0) > 0 ? Number(this.totalDue) : Math.max(0, calculatedDue));
  const paid = round2(Math.min(Number(this.paid || this.amount || 0), totalDue));
  this.sessionRate = round2(Number(this.sessionRate || 0));
  this.grossAmount = round2(grossAmount);
  this.administrationPercentage = round2(administrationPercentage);
  this.teacherPercentage = round2(teacherPercentage);
  this.administrationShare = round2(administrationShare);
  this.teacherShareAmount = round2(teacherShareAmount);
  this.deductions = deductions;
  this.manualAdjustment = manualAdjustment;
  this.netTeacherAmount = round2(netTeacherAmount);
  this.totalDue = totalDue;
  this.paid = paid;
  this.remaining = round2(Math.max(0, totalDue - paid));
  this.amount = paid;
  this.paymentStatus = paid <= 0 ? "unpaid" : this.remaining <= 0 ? "paid" : "partial";
  this.status = this.remaining <= 0 && paid > 0 ? "paid" : "pending";
  if (this.status === "paid" && this.remaining > 0) {
    this.status = "pending";
  }
});

TeacherPayoutSchema.index({ payoutDate: -1 });
TeacherPayoutSchema.index({ teacherId: 1 });
TeacherPayoutSchema.index({ status: 1 });
TeacherPayoutSchema.index({ recordType: 1, teacherId: 1, invoicePeriod: 1 });

const TeacherPayout: Model<ITeacherPayout> =
  mongoose.models.TeacherPayout ??
  mongoose.model<ITeacherPayout>("TeacherPayout", TeacherPayoutSchema);

export default TeacherPayout;
