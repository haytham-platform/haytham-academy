import mongoose, { Schema, type Document, type Model, Types } from "mongoose";
import type { EnrollmentStatus } from "@/types";

export interface IEnrollment extends Document {
  student: Types.ObjectId;
  course: Types.ObjectId;
  status: EnrollmentStatus;
  note?: string;
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
      enum: ["pending", "approved", "rejected", "cancelled", "accepted"],
      default: "pending",
    },
    note: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

EnrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
EnrollmentSchema.index({ status: 1, createdAt: -1 });
EnrollmentSchema.index({ course: 1, status: 1 });

const Enrollment: Model<IEnrollment> =
  mongoose.models.Enrollment ??
  mongoose.model<IEnrollment>("Enrollment", EnrollmentSchema);

export default Enrollment;

export type EnrollmentDocument = IEnrollment & { _id: Types.ObjectId };
