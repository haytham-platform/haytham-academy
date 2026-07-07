import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export interface ITeacher extends Document {
  name: string;
  subject: string;
  phone: string;
  teachingLevel: string;
  adminShare?: number;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherSchema = new Schema<ITeacher>(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    teachingLevel: { type: String, required: true, trim: true },
    adminShare: { type: Number, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

TeacherSchema.index({ deletedAt: 1, createdAt: -1 });

if (process.env.NODE_ENV === "development" && mongoose.models.Teacher) {
  delete mongoose.models.Teacher;
}

const Teacher: Model<ITeacher> =
  mongoose.models.Teacher ?? mongoose.model<ITeacher>("Teacher", TeacherSchema);

export default Teacher;

export type TeacherDocument = ITeacher & { _id: Types.ObjectId };
