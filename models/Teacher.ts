import mongoose, { Schema, type Document, type Model, Types } from "mongoose";
import type {
  TeacherAttendanceRecord,
  TeacherContract,
  TeacherDocument as TeacherFileDocument,
  TeacherEmploymentType,
  TeacherMoneyRecord,
  TeacherPerformanceRecord,
  TeacherQualification,
  TeacherSalaryConfig,
  TeacherScheduleItem,
  TeacherStatus,
} from "@/types";

export interface ITeacher extends Document {
  name: string;
  subject: string;
  phone: string;
  teachingLevel: string;
  email?: string;
  address?: string;
  nationalId?: string;
  emergencyPhone?: string;
  hireDate?: Date;
  employmentType?: TeacherEmploymentType;
  status: TeacherStatus;
  qualifications: TeacherQualification[];
  subjects: string[];
  academicLevels: string[];
  assignedClasses: string[];
  weeklySchedule: TeacherScheduleItem[];
  attendance: TeacherAttendanceRecord[];
  salaryConfig?: TeacherSalaryConfig;
  salaryHistory: TeacherMoneyRecord[];
  bonuses: TeacherMoneyRecord[];
  deductions: TeacherMoneyRecord[];
  contracts: TeacherContract[];
  documents: TeacherFileDocument[];
  notes?: string;
  performanceRecords: TeacherPerformanceRecord[];
  adminShare?: number;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const QualificationSchema = new Schema<TeacherQualification>(
  {
    degree: { type: String, required: true, trim: true },
    institution: { type: String, trim: true },
    field: { type: String, trim: true },
    year: { type: Number, min: 1900, max: 2200 },
  },
  { _id: false }
);

const ScheduleSchema = new Schema<TeacherScheduleItem>(
  {
    day: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    className: { type: String, trim: true },
    subject: { type: String, trim: true },
    room: { type: String, trim: true },
  },
  { _id: false }
);

const AttendanceSchema = new Schema<TeacherAttendanceRecord>(
  {
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["present", "absent", "late", "excused"],
      required: true,
    },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const MoneyRecordSchema = new Schema<TeacherMoneyRecord>(
  {
    title: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const SalaryConfigSchema = new Schema<TeacherSalaryConfig>(
  {
    type: {
      type: String,
      enum: ["fixed", "hourly", "per_session"],
      default: "per_session",
    },
    baseSalary: { type: Number, min: 0 },
    hourlyRate: { type: Number, min: 0 },
    sessionRate: { type: Number, min: 0 },
    currency: { type: String, default: "DZD", trim: true },
    effectiveFrom: { type: Date },
  },
  { _id: false }
);

const ContractSchema = new Schema<TeacherContract>(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "expired", "terminated", "draft"],
      default: "active",
    },
    startDate: { type: Date },
    endDate: { type: Date },
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const DocumentSchema = new Schema<TeacherFileDocument>(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true, default: "other" },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PerformanceSchema = new Schema<TeacherPerformanceRecord>(
  {
    date: { type: Date, required: true },
    title: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5 },
    note: { type: String, trim: true },
    createdBy: { type: String, trim: true },
  },
  { _id: false }
);

const TeacherSchema = new Schema<ITeacher>(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    teachingLevel: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    nationalId: { type: String, trim: true },
    emergencyPhone: { type: String, trim: true },
    hireDate: { type: Date },
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "visiting"],
      default: "part_time",
    },
    status: {
      type: String,
      enum: ["active", "on_leave", "suspended", "resigned"],
      default: "active",
      index: true,
    },
    qualifications: { type: [QualificationSchema], default: [] },
    subjects: { type: [String], default: [] },
    academicLevels: { type: [String], default: [] },
    assignedClasses: { type: [String], default: [] },
    weeklySchedule: { type: [ScheduleSchema], default: [] },
    attendance: { type: [AttendanceSchema], default: [] },
    salaryConfig: { type: SalaryConfigSchema, default: () => ({ type: "per_session", currency: "DZD" }) },
    salaryHistory: { type: [MoneyRecordSchema], default: [] },
    bonuses: { type: [MoneyRecordSchema], default: [] },
    deductions: { type: [MoneyRecordSchema], default: [] },
    contracts: { type: [ContractSchema], default: [] },
    documents: { type: [DocumentSchema], default: [] },
    notes: { type: String, trim: true },
    performanceRecords: { type: [PerformanceSchema], default: [] },
    adminShare: { type: Number, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

TeacherSchema.index({ deletedAt: 1, createdAt: -1 });
TeacherSchema.index({ name: "text", phone: "text", subject: "text", subjects: "text", academicLevels: "text", assignedClasses: "text" });

if (process.env.NODE_ENV === "development" && mongoose.models.Teacher) {
  delete mongoose.models.Teacher;
}

const Teacher: Model<ITeacher> =
  mongoose.models.Teacher ?? mongoose.model<ITeacher>("Teacher", TeacherSchema);

export default Teacher;

export type TeacherDocument = ITeacher & { _id: Types.ObjectId };
