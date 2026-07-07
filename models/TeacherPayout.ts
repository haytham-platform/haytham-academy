import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type PayoutType = "fixed" | "percentage" | "per_session" | "other";
export type PayoutStatus = "pending" | "paid";

export interface ITeacherPayout extends Document {
  teacherId: Types.ObjectId;
  courseId?: Types.ObjectId;
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
    amount: { type: Number, required: true, min: 0.01 },
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

TeacherPayoutSchema.index({ payoutDate: -1 });
TeacherPayoutSchema.index({ teacherId: 1 });
TeacherPayoutSchema.index({ status: 1 });

const TeacherPayout: Model<ITeacherPayout> =
  mongoose.models.TeacherPayout ??
  mongoose.model<ITeacherPayout>("TeacherPayout", TeacherPayoutSchema);

export default TeacherPayout;
