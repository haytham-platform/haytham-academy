import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type PayoutType = "fixed" | "percentage" | "per_session" | "other";
export type PayoutStatus = "pending" | "paid";

export interface ITeacherPayout extends Document {
  teacherId: Types.ObjectId;
  courseId?: Types.ObjectId;
  numberOfSessions: number;
  extraSessions: number;
  sessionRate: number;
  manualAdjustment: number;
  totalDue: number;
  paid: number;
  remaining: number;
  amount: number;
  payoutType: PayoutType;
  payoutDate: Date;
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
    numberOfSessions: { type: Number, default: 0, min: 0 },
    extraSessions: { type: Number, default: 0, min: 0 },
    sessionRate: { type: Number, default: 0, min: 0 },
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
  const calculatedDue = sessions * Number(this.sessionRate || 0) + Number(this.manualAdjustment || 0);
  const totalDue = Number(this.totalDue || 0) > 0 ? Number(this.totalDue) : Math.max(0, calculatedDue);
  const paid = Number(this.paid || this.amount || 0);
  this.totalDue = totalDue;
  this.paid = paid;
  this.remaining = Math.max(0, totalDue - paid);
  this.amount = paid;
  if (this.status === "paid" && this.remaining > 0) {
    this.status = "pending";
  }
});

TeacherPayoutSchema.index({ payoutDate: -1 });
TeacherPayoutSchema.index({ teacherId: 1 });
TeacherPayoutSchema.index({ status: 1 });

const TeacherPayout: Model<ITeacherPayout> =
  mongoose.models.TeacherPayout ??
  mongoose.model<ITeacherPayout>("TeacherPayout", TeacherPayoutSchema);

export default TeacherPayout;
