import mongoose, { Schema, type Document, type Model } from "mongoose";
import type {
  EmergencyContact,
  StudentDocument,
  StudentGender,
  StudentStatus,
  UserRole,
} from "@/types";

export interface IUser extends Document {
  studentNumber?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email?: string;
  phone?: string;
  secondaryPhone?: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  status: StudentStatus;
  gender?: StudentGender;
  dateOfBirth?: Date;
  placeOfBirth?: string;
  nationality?: string;
  profilePhotoUrl?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelationship?: string;
  address?: string;
  wilaya?: string;
  commune?: string;
  municipality?: string;
  registrationDate?: Date;
  academicSeason?: string;
  academicLevel?: string;
  grade?: string;
  specialization?: string;
  groupName?: string;
  enrollmentType?: string;
  previousSchool?: string;
  previousResults?: string;
  isRepeating?: boolean;
  enrollmentStartDate?: Date;
  enrollmentEndDate?: Date;
  className?: string;
  studyLevel?: string;
  institution?: string;
  medicalNotes?: string;
  notes?: string;
  emergencyContacts?: EmergencyContact[];
  documents?: StudentDocument[];
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyContactSchema = new Schema<EmergencyContact>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    relationship: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const StudentDocumentSchema = new Schema<StudentDocument>(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, default: "other", trim: true },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected", "expired"],
      default: "pending",
    },
    verifiedBy: { type: String, trim: true },
    verifiedAt: { type: Date },
    expiresAt: { type: Date },
    size: { type: Number, min: 0 },
    mimeType: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    studentNumber: { type: String, unique: true, sparse: true, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    phone: { type: String, unique: true, sparse: true, trim: true },
    secondaryPhone: { type: String, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["admin", "deputy", "secretary", "teacher", "student"],
      default: "student",
    },
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["active", "pending", "suspended", "withdrawn", "graduated", "archived"],
      default: "active",
    },
    gender: { type: String, enum: ["male", "female"] },
    dateOfBirth: { type: Date },
    placeOfBirth: { type: String, trim: true },
    nationality: { type: String, trim: true },
    profilePhotoUrl: { type: String, trim: true },
    guardianName: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },
    guardianRelationship: { type: String, trim: true },
    address: { type: String, trim: true },
    wilaya: { type: String, trim: true },
    commune: { type: String, trim: true },
    municipality: { type: String, trim: true },
    registrationDate: { type: Date },
    academicSeason: { type: String, trim: true },
    academicLevel: { type: String, trim: true },
    grade: { type: String, trim: true },
    specialization: { type: String, trim: true },
    groupName: { type: String, trim: true },
    enrollmentType: { type: String, trim: true },
    previousSchool: { type: String, trim: true },
    previousResults: { type: String, trim: true },
    isRepeating: { type: Boolean, default: false },
    enrollmentStartDate: { type: Date },
    enrollmentEndDate: { type: Date },
    className: { type: String, trim: true },
    studyLevel: { type: String, trim: true },
    institution: { type: String, trim: true },
    medicalNotes: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    emergencyContacts: { type: [EmergencyContactSchema], default: [] },
    documents: { type: [StudentDocumentSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, deletedAt: 1, createdAt: -1 });
UserSchema.index({ role: 1, status: 1, deletedAt: 1 });
UserSchema.index({ role: 1, academicLevel: 1, className: 1, deletedAt: 1 });
UserSchema.index({ role: 1, academicSeason: 1, academicLevel: 1, status: 1 });
UserSchema.index({ role: 1, studentNumber: 1 });
UserSchema.index({ name: "text", firstName: "text", lastName: "text", studentNumber: "text", phone: "text", secondaryPhone: "text", email: "text", guardianName: "text", guardianPhone: "text", academicLevel: "text", className: "text", groupName: "text", institution: "text" });

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
