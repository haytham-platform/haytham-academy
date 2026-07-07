import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type PaymentMethod = "cash" | "baridimob" | "bank_transfer" | "other";
export type PaymentType = "course_fee" | "registration_fee" | "other";

export interface IPayment extends Document {
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  enrollmentId?: Types.ObjectId;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  type: PaymentType;
  note?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment" },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: {
      type: String,
      enum: ["cash", "baridimob", "bank_transfer", "other"],
      required: true,
    },
    paymentDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ["course_fee", "registration_fee", "other"],
      default: "course_fee",
    },
    note: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ paymentDate: -1 });
PaymentSchema.index({ studentId: 1 });
PaymentSchema.index({ courseId: 1 });

const Payment: Model<IPayment> =
  mongoose.models.Payment ?? mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
