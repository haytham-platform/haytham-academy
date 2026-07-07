import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { StudentGender, UserRole } from "@/types";

export interface IUser extends Document {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  gender?: StudentGender;
  dateOfBirth?: Date;
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  wilaya?: string;
  commune?: string;
  studyLevel?: string;
  institution?: string;
  notes?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    phone: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["admin", "deputy", "secretary", "teacher", "student"],
      default: "student",
    },
    isActive: { type: Boolean, default: true },
    gender: { type: String, enum: ["male", "female"] },
    dateOfBirth: { type: Date },
    guardianName: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },
    address: { type: String, trim: true },
    wilaya: { type: String, trim: true },
    commune: { type: String, trim: true },
    studyLevel: { type: String, trim: true },
    institution: { type: String, trim: true },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, deletedAt: 1, createdAt: -1 });
UserSchema.index({ name: "text", phone: "text", email: "text" });

UserSchema.pre("validate", function () {
  if (this.role === "student") {
    if (!this.phone) {
      throw new Error("يجب توفير رقم الهاتف");
    }
    return;
  }
  if (!this.email && !this.phone) {
    throw new Error("يجب توفير البريد الإلكتروني أو رقم الهاتف");
  }
});

const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;
