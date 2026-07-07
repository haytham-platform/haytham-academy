import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type LessonPaymentStatus = "paid" | "unpaid" | "partial";

export interface ILessonInvoice extends Document {
  studentId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  courseId: Types.ObjectId;
  teacherId: Types.ObjectId;
  subject: string;
  sessionCount: number;
  pricePerSession: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: LessonPaymentStatus;
  invoiceDate: Date;
  note?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LessonInvoiceSchema = new Schema<ILessonInvoice>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    subject: { type: String, required: true, trim: true },
    sessionCount: { type: Number, required: true, min: 1 },
    pricePerSession: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid", "partial"],
      required: true,
    },
    invoiceDate: { type: Date, required: true },
    note: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

LessonInvoiceSchema.index({ teacherId: 1, invoiceDate: -1 });
LessonInvoiceSchema.index({ studentId: 1 });
LessonInvoiceSchema.index({ enrollmentId: 1 });
LessonInvoiceSchema.index({ invoiceDate: -1 });

if (process.env.NODE_ENV === "development" && mongoose.models.LessonInvoice) {
  delete mongoose.models.LessonInvoice;
}

const LessonInvoice: Model<ILessonInvoice> =
  mongoose.models.LessonInvoice ??
  mongoose.model<ILessonInvoice>("LessonInvoice", LessonInvoiceSchema);

export default LessonInvoice;
