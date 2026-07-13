import mongoose, { Schema, type Document, type Model, Types } from "mongoose";
import type { EnrollmentStatus } from "@/types";

export interface IEnrollment extends Document {
  student: Types.ObjectId;
  course: Types.ObjectId;
  status: EnrollmentStatus;
  note?: string;
  academicSeason?: string;
  academicLevel?: string;
  className?: string;
  enrollmentType?: string;
  registrationFee?: number;
  tuitionFee?: number;
  discount?: number;
  finalPrice?: number;
  paymentPlan?: string;
  startDate?: Date;
  endDate?: Date;
  subjects?: string[];
  teachers?: Types.ObjectId[];
  documents?: {
    title: string;
    type: string;
    url: string;
    uploadedAt: Date;
  }[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled", "accepted", "suspended", "reactivated", "transferred", "completed", "archived"],
      default: "pending",
    },
    note: { type: String, default: "", trim: true },
    academicSeason: { type: String, default: "", trim: true },
    academicLevel: { type: String, default: "", trim: true },
    className: { type: String, default: "", trim: true },
    enrollmentType: { type: String, default: "", trim: true },
    registrationFee: { type: Number, default: 0, min: 0 },
    tuitionFee: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    finalPrice: { type: Number, default: 0, min: 0 },
    paymentPlan: { type: String, default: "", trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    subjects: [{ type: String, trim: true }],
    teachers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    documents: [
      {
        title: { type: String, required: true, trim: true },
        type: { type: String, default: "other", trim: true },
        url: { type: String, required: true, trim: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

EnrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
EnrollmentSchema.index({ status: 1, createdAt: -1 });
EnrollmentSchema.index({ course: 1, status: 1 });
EnrollmentSchema.index({ student: 1, academicSeason: 1, enrollmentType: 1, status: 1 });

const Enrollment: Model<IEnrollment> =
  mongoose.models.Enrollment ??
  mongoose.model<IEnrollment>("Enrollment", EnrollmentSchema);

export default Enrollment;

export type EnrollmentDocument = IEnrollment & { _id: Types.ObjectId };
