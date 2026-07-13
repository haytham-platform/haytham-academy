import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export interface IGuardian extends Document {
  fullName: string;
  relationship: string;
  primaryPhone: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  workplace?: string;
  notes?: string;
  studentIds: Types.ObjectId[];
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentGuardianLink extends Document {
  studentId: Types.ObjectId;
  guardianId: Types.ObjectId;
  relationship: string;
  isPrimary: boolean;
  financiallyResponsible: boolean;
  authorizedPickup: boolean;
  notes?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentAttendance extends Document {
  studentId: Types.ObjectId;
  contextType: "class" | "course" | "support_lesson" | "private_lesson" | "kindergarten" | "other";
  contextId?: Types.ObjectId;
  courseId?: Types.ObjectId;
  teacherId?: Types.ObjectId;
  academicSeason?: string;
  academicLevel?: string;
  className?: string;
  date: Date;
  status: "present" | "absent" | "late" | "excused" | "left_early" | "cancelled";
  excuseReason?: string;
  notes?: string;
  recordedBy: Types.ObjectId;
  correctionHistory: Record<string, unknown>[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentPerformance extends Document {
  studentId: Types.ObjectId;
  subject: string;
  academicSeason?: string;
  academicPeriod?: string;
  teacherId?: Types.ObjectId;
  type: "test" | "exam" | "homework" | "participation" | "project" | "teacher_evaluation";
  score: number;
  maxScore: number;
  average?: number;
  rank?: number;
  remarks?: string;
  strengths?: string;
  weaknesses?: string;
  recommendations?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  changeHistory: Record<string, unknown>[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentBehavior extends Document {
  studentId: Types.ObjectId;
  type: "positive" | "warning" | "incident" | "violation" | "disciplinary_action" | "suspension" | "guardian_meeting" | "follow_up";
  title: string;
  description?: string;
  actionTaken?: string;
  resolutionStatus: "open" | "in_progress" | "resolved" | "archived";
  attachments: string[];
  recordedBy: Types.ObjectId;
  occurredAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentCommunication extends Document {
  studentId: Types.ObjectId;
  type: "internal_notification" | "sms" | "email" | "whatsapp" | "phone_call" | "guardian_meeting" | "administrative_notice";
  subject: string;
  content: string;
  recipient: string;
  relatedType?: "attendance" | "payment" | "enrollment" | "general";
  relatedId?: Types.ObjectId;
  deliveryStatus?: string;
  notes?: string;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentNote extends Document {
  studentId: Types.ObjectId;
  category: "academic" | "administrative" | "financial" | "medical" | "behavioral" | "guardian" | "general";
  note: string;
  visibility: "internal" | "staff" | "guardian" | "student";
  author: Types.ObjectId;
  editHistory: Record<string, unknown>[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentRolloverAudit extends Document {
  sourceSeason: string;
  targetSeason: string;
  changes: Record<string, unknown>[];
  executedBy: Types.ObjectId;
  createdAt: Date;
}

const GuardianSchema = new Schema<IGuardian>(
  {
    fullName: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
    primaryPhone: { type: String, required: true, trim: true },
    secondaryPhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    occupation: { type: String, trim: true },
    workplace: { type: String, trim: true },
    notes: { type: String, trim: true },
    studentIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const StudentGuardianLinkSchema = new Schema<IStudentGuardianLink>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    guardianId: { type: Schema.Types.ObjectId, ref: "Guardian", required: true },
    relationship: { type: String, required: true, trim: true },
    isPrimary: { type: Boolean, default: false },
    financiallyResponsible: { type: Boolean, default: false },
    authorizedPickup: { type: Boolean, default: false },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const AttendanceSchema = new Schema<IStudentAttendance>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    contextType: { type: String, required: true },
    contextId: { type: Schema.Types.ObjectId },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
    academicSeason: { type: String, trim: true },
    academicLevel: { type: String, trim: true },
    className: { type: String, trim: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "absent", "late", "excused", "left_early", "cancelled"], required: true },
    excuseReason: { type: String, trim: true },
    notes: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    correctionHistory: { type: [{}], default: [] },
  },
  { timestamps: true }
);

const PerformanceSchema = new Schema<IStudentPerformance>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true, trim: true },
    academicSeason: { type: String, trim: true },
    academicPeriod: { type: String, trim: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
    type: { type: String, enum: ["test", "exam", "homework", "participation", "project", "teacher_evaluation"], required: true },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 1 },
    average: { type: Number, min: 0 },
    rank: { type: Number, min: 1 },
    remarks: { type: String, trim: true },
    strengths: { type: String, trim: true },
    weaknesses: { type: String, trim: true },
    recommendations: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    changeHistory: { type: [{}], default: [] },
  },
  { timestamps: true }
);

const BehaviorSchema = new Schema<IStudentBehavior>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    actionTaken: { type: String, trim: true },
    resolutionStatus: { type: String, enum: ["open", "in_progress", "resolved", "archived"], default: "open" },
    attachments: { type: [String], default: [] },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    occurredAt: { type: Date, required: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

const CommunicationSchema = new Schema<IStudentCommunication>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    subject: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    recipient: { type: String, required: true, trim: true },
    relatedType: { type: String, trim: true },
    relatedId: { type: Schema.Types.ObjectId },
    deliveryStatus: { type: String, trim: true },
    notes: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const NoteSchema = new Schema<IStudentNote>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    note: { type: String, required: true, trim: true },
    visibility: { type: String, enum: ["internal", "staff", "guardian", "student"], default: "internal" },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    editHistory: { type: [{}], default: [] },
  },
  { timestamps: true }
);

const RolloverSchema = new Schema<IStudentRolloverAudit>(
  {
    sourceSeason: { type: String, required: true, trim: true },
    targetSeason: { type: String, required: true, trim: true },
    changes: { type: [{}], default: [] },
    executedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

GuardianSchema.index({ primaryPhone: 1, fullName: 1 }, { unique: true });
GuardianSchema.index({ studentIds: 1 });
StudentGuardianLinkSchema.index({ studentId: 1, guardianId: 1 }, { unique: true });
StudentGuardianLinkSchema.index({ guardianId: 1, isPrimary: 1 });
AttendanceSchema.index({ studentId: 1, date: -1 });
AttendanceSchema.index({ contextType: 1, contextId: 1, date: -1 });
AttendanceSchema.index({ academicSeason: 1, className: 1, date: -1 });
PerformanceSchema.index({ studentId: 1, academicSeason: 1, subject: 1 });
BehaviorSchema.index({ studentId: 1, occurredAt: -1, resolutionStatus: 1 });
CommunicationSchema.index({ studentId: 1, createdAt: -1, type: 1 });
NoteSchema.index({ studentId: 1, category: 1, createdAt: -1 });
RolloverSchema.index({ sourceSeason: 1, targetSeason: 1, createdAt: -1 });

export const Guardian: Model<IGuardian> =
  mongoose.models.Guardian ?? mongoose.model<IGuardian>("Guardian", GuardianSchema);
export const StudentGuardianLink: Model<IStudentGuardianLink> =
  mongoose.models.StudentGuardianLink ?? mongoose.model<IStudentGuardianLink>("StudentGuardianLink", StudentGuardianLinkSchema);
export const StudentAttendance: Model<IStudentAttendance> =
  mongoose.models.StudentAttendance ?? mongoose.model<IStudentAttendance>("StudentAttendance", AttendanceSchema);
export const StudentPerformance: Model<IStudentPerformance> =
  mongoose.models.StudentPerformance ?? mongoose.model<IStudentPerformance>("StudentPerformance", PerformanceSchema);
export const StudentBehavior: Model<IStudentBehavior> =
  mongoose.models.StudentBehavior ?? mongoose.model<IStudentBehavior>("StudentBehavior", BehaviorSchema);
export const StudentCommunication: Model<IStudentCommunication> =
  mongoose.models.StudentCommunication ?? mongoose.model<IStudentCommunication>("StudentCommunication", CommunicationSchema);
export const StudentNote: Model<IStudentNote> =
  mongoose.models.StudentNote ?? mongoose.model<IStudentNote>("StudentNote", NoteSchema);
export const StudentRolloverAudit: Model<IStudentRolloverAudit> =
  mongoose.models.StudentRolloverAudit ?? mongoose.model<IStudentRolloverAudit>("StudentRolloverAudit", RolloverSchema);
