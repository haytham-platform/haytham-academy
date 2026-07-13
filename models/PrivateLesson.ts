import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type PrivateLessonFormat = "individual" | "small_group" | "online" | "in_person";
export type PrivateLessonStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "postponed" | "no_show" | "in_progress" | "archived";
export type PrivateLessonPaymentStatus = "unpaid" | "partially_paid" | "paid" | "refunded" | "exempted" | "cancelled";
export type PrivateLessonPricingMethod = "fixed" | "hourly" | "per_student_group" | "teacher_rate" | "academic_level_default" | "system_default" | "manual_override";
export type PrivateLessonCompensationMethod = "fixed" | "hourly" | "percentage" | "per_student" | "manual_override";
export type TeacherLessonCompensationStatus = "pending" | "approved" | "paid" | "cancelled" | "disputed";
export type StudentLessonAttendanceStatus = "present" | "absent" | "late" | "excused" | "no_show" | "pending";
export type TeacherLessonAttendanceStatus = "present" | "absent" | "late" | "replacement_teacher" | "cancelled_by_teacher" | "pending";

export interface IPrivateLessonStudentSnapshot {
  studentId: Types.ObjectId;
  name: string;
  phone?: string;
  academicLevel?: string;
  status?: string;
  chargeId?: Types.ObjectId;
  attendanceStatus: StudentLessonAttendanceStatus;
}

export interface IPrivateLessonPricingSnapshot {
  method: PrivateLessonPricingMethod;
  configurationId?: Types.ObjectId;
  baseAmountMinor: number;
  finalAmountMinor: number;
  currency: string;
  durationMinutes: number;
  studentCount: number;
  manualOverride: boolean;
  manualOverrideReason?: string;
  details?: Record<string, unknown>;
}

export interface IPrivateLessonCompensationSnapshot {
  method: PrivateLessonCompensationMethod;
  configurationId?: Types.ObjectId;
  amountMinor: number;
  academyShareMinor: number;
  status: TeacherLessonCompensationStatus;
  paymentStatus: TeacherLessonCompensationStatus;
  approvalStatus: "pending" | "approved" | "rejected";
  manualOverride: boolean;
  manualOverrideReason?: string;
  details?: Record<string, unknown>;
}

export interface IPrivateLessonCancellation {
  cancelledBy: Types.ObjectId;
  cancellationDate: Date;
  cancelledByType: "student" | "teacher" | "academy" | "admin";
  reason: string;
  refundEligibility: "full" | "partial" | "none";
  teacherCompensationEligibility: "full" | "partial" | "none";
  reschedulingStatus: "not_required" | "pending" | "rescheduled";
  chargePolicy: "full_charge" | "partial_charge" | "no_charge";
  notes?: string;
}

export interface IPrivateLessonNote {
  lessonId: Types.ObjectId;
  note: string;
  type: "lesson" | "academic" | "student_performance" | "teacher" | "administrative";
  visibility: "internal" | "staff" | "teacher" | "student";
  author: Types.ObjectId;
  history: { note: string; updatedBy: Types.ObjectId; updatedAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrivateLesson extends Document {
  students: IPrivateLessonStudentSnapshot[];
  teacherId: Types.ObjectId;
  originalTeacherId?: Types.ObjectId;
  replacementTeacherId?: Types.ObjectId;
  replacementReason?: string;
  subject: string;
  academicLevel: string;
  academicSeason?: string;
  lessonDate: Date;
  startTime: string;
  endTime: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  room?: string;
  location?: string;
  onlineMeetingLink?: string;
  format: PrivateLessonFormat;
  status: PrivateLessonStatus;
  studentAttendanceStatus: StudentLessonAttendanceStatus;
  teacherAttendanceStatus: TeacherLessonAttendanceStatus;
  pricing: IPrivateLessonPricingSnapshot;
  compensation: IPrivateLessonCompensationSnapshot;
  paymentStatus: PrivateLessonPaymentStatus;
  notes?: string;
  cancellation?: IPrivateLessonCancellation;
  postponedFrom?: Date;
  postponedReason?: string;
  seriesId?: Types.ObjectId;
  recurringIndex?: number;
  isRecurring: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrivateLessonSeries extends Document {
  frequency: "weekly" | "custom";
  daysOfWeek: number[];
  startDate: Date;
  endDate?: Date;
  numberOfSessions?: number;
  defaultStartTime: string;
  defaultEndTime: string;
  teacherId: Types.ObjectId;
  students: Types.ObjectId[];
  subject: string;
  academicLevel: string;
  academicSeason?: string;
  format: PrivateLessonFormat;
  room?: string;
  location?: string;
  pricingSnapshot: IPrivateLessonPricingSnapshot;
  status: "active" | "completed" | "cancelled" | "archived";
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrivateLessonPricing extends Document {
  configurationType: "academic_level_default" | "teacher_specific" | "system_default";
  academicLevel?: string;
  teacherId?: Types.ObjectId;
  subject?: string;
  pricingMethod: Exclude<PrivateLessonPricingMethod, "manual_override">;
  amountMinor: number;
  currency: string;
  effectiveDate: Date;
  expirationDate?: Date;
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeacherLessonCompensation extends Document {
  lessonId: Types.ObjectId;
  teacherId: Types.ObjectId;
  originalTeacherId?: Types.ObjectId;
  amountMinor: number;
  academyShareMinor: number;
  revenueMinor: number;
  method: PrivateLessonCompensationMethod;
  calculationSnapshot: Record<string, unknown>;
  status: TeacherLessonCompensationStatus;
  approvalStatus: "pending" | "approved" | "rejected";
  paymentStatus: TeacherLessonCompensationStatus;
  salaryPeriod?: string;
  teacherAccountId?: Types.ObjectId;
  payoutId?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrivateLessonAttendance extends Document {
  lessonId: Types.ObjectId;
  studentAttendance: {
    studentId: Types.ObjectId;
    status: StudentLessonAttendanceStatus;
    checkInTime?: Date;
    checkOutTime?: Date;
    notes?: string;
  }[];
  teacherId: Types.ObjectId;
  teacherStatus: TeacherLessonAttendanceStatus;
  teacherCheckInTime?: Date;
  teacherCheckOutTime?: Date;
  recordedBy: Types.ObjectId;
  notes?: string;
  modificationHistory: Record<string, unknown>[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrivateLessonPerformance extends Document {
  lessonId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  subject: string;
  academicSeason?: string;
  objectives?: string;
  topicsCovered?: string;
  homework?: string;
  studentUnderstanding?: string;
  studentParticipation?: string;
  teacherEvaluation?: string;
  progressScore?: number;
  recommendations?: string;
  nextLessonPlan?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const moneyField = { type: Number, required: true, min: 0, validate: Number.isInteger };

const StudentSnapshotSchema = new Schema<IPrivateLessonStudentSnapshot>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    academicLevel: { type: String, trim: true },
    status: { type: String, trim: true },
    chargeId: { type: Schema.Types.ObjectId, ref: "StudentCharge" },
    attendanceStatus: { type: String, enum: ["present", "absent", "late", "excused", "no_show", "pending"], default: "pending" },
  },
  { _id: false }
);

const PricingSnapshotSchema = new Schema<IPrivateLessonPricingSnapshot>(
  {
    method: { type: String, required: true },
    configurationId: { type: Schema.Types.ObjectId },
    baseAmountMinor: moneyField,
    finalAmountMinor: moneyField,
    currency: { type: String, default: "DZD", trim: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    studentCount: { type: Number, required: true, min: 1 },
    manualOverride: { type: Boolean, default: false },
    manualOverrideReason: { type: String, trim: true },
    details: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const CompensationSnapshotSchema = new Schema<IPrivateLessonCompensationSnapshot>(
  {
    method: { type: String, required: true },
    configurationId: { type: Schema.Types.ObjectId },
    amountMinor: moneyField,
    academyShareMinor: moneyField,
    status: { type: String, enum: ["pending", "approved", "paid", "cancelled", "disputed"], default: "pending" },
    paymentStatus: { type: String, enum: ["pending", "approved", "paid", "cancelled", "disputed"], default: "pending" },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    manualOverride: { type: Boolean, default: false },
    manualOverrideReason: { type: String, trim: true },
    details: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const CancellationSchema = new Schema<IPrivateLessonCancellation>(
  {
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cancellationDate: { type: Date, required: true },
    cancelledByType: { type: String, enum: ["student", "teacher", "academy", "admin"], required: true },
    reason: { type: String, required: true, trim: true },
    refundEligibility: { type: String, enum: ["full", "partial", "none"], default: "none" },
    teacherCompensationEligibility: { type: String, enum: ["full", "partial", "none"], default: "none" },
    reschedulingStatus: { type: String, enum: ["not_required", "pending", "rescheduled"], default: "not_required" },
    chargePolicy: { type: String, enum: ["full_charge", "partial_charge", "no_charge"], default: "no_charge" },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const PrivateLessonNoteSchema = new Schema<IPrivateLessonNote>(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: "PrivateLesson", required: true },
    note: { type: String, required: true, trim: true },
    type: { type: String, enum: ["lesson", "academic", "student_performance", "teacher", "administrative"], default: "lesson" },
    visibility: { type: String, enum: ["internal", "staff", "teacher", "student"], default: "internal" },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    history: { type: [{}], default: [] },
  },
  { timestamps: true }
);

const PrivateLessonSchema = new Schema<IPrivateLesson>(
  {
    students: { type: [StudentSnapshotSchema], required: true, default: [] },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    originalTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
    replacementTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
    replacementReason: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    academicLevel: { type: String, required: true, trim: true },
    academicSeason: { type: String, trim: true },
    lessonDate: { type: Date, required: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    room: { type: String, trim: true },
    location: { type: String, trim: true },
    onlineMeetingLink: { type: String, trim: true },
    format: { type: String, enum: ["individual", "small_group", "online", "in_person"], required: true },
    status: { type: String, enum: ["scheduled", "confirmed", "completed", "cancelled", "postponed", "no_show", "in_progress", "archived"], default: "scheduled" },
    studentAttendanceStatus: { type: String, enum: ["present", "absent", "late", "excused", "no_show", "pending"], default: "pending" },
    teacherAttendanceStatus: { type: String, enum: ["present", "absent", "late", "replacement_teacher", "cancelled_by_teacher", "pending"], default: "pending" },
    pricing: { type: PricingSnapshotSchema, required: true },
    compensation: { type: CompensationSnapshotSchema, required: true },
    paymentStatus: { type: String, enum: ["unpaid", "partially_paid", "paid", "refunded", "exempted", "cancelled"], default: "unpaid" },
    notes: { type: String, trim: true },
    cancellation: { type: CancellationSchema },
    postponedFrom: { type: Date },
    postponedReason: { type: String, trim: true },
    seriesId: { type: Schema.Types.ObjectId, ref: "PrivateLessonSeries" },
    recurringIndex: { type: Number, min: 0 },
    isRecurring: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const PrivateLessonSeriesSchema = new Schema<IPrivateLessonSeries>(
  {
    frequency: { type: String, enum: ["weekly", "custom"], required: true },
    daysOfWeek: { type: [Number], default: [] },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    numberOfSessions: { type: Number, min: 1 },
    defaultStartTime: { type: String, required: true, trim: true },
    defaultEndTime: { type: String, required: true, trim: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    students: [{ type: Schema.Types.ObjectId, ref: "User" }],
    subject: { type: String, required: true, trim: true },
    academicLevel: { type: String, required: true, trim: true },
    academicSeason: { type: String, trim: true },
    format: { type: String, enum: ["individual", "small_group", "online", "in_person"], default: "individual" },
    room: { type: String, trim: true },
    location: { type: String, trim: true },
    pricingSnapshot: { type: PricingSnapshotSchema, required: true },
    status: { type: String, enum: ["active", "completed", "cancelled", "archived"], default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const PrivateLessonPricingSchema = new Schema<IPrivateLessonPricing>(
  {
    configurationType: { type: String, enum: ["academic_level_default", "teacher_specific", "system_default"], required: true },
    academicLevel: { type: String, trim: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
    subject: { type: String, trim: true },
    pricingMethod: { type: String, enum: ["fixed", "hourly", "per_student_group", "teacher_rate", "academic_level_default", "system_default"], required: true },
    amountMinor: moneyField,
    currency: { type: String, default: "DZD", trim: true },
    effectiveDate: { type: Date, required: true },
    expirationDate: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const TeacherLessonCompensationSchema = new Schema<ITeacherLessonCompensation>(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: "PrivateLesson", required: true, unique: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    originalTeacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
    amountMinor: moneyField,
    academyShareMinor: moneyField,
    revenueMinor: moneyField,
    method: { type: String, required: true },
    calculationSnapshot: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["pending", "approved", "paid", "cancelled", "disputed"], default: "pending" },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    paymentStatus: { type: String, enum: ["pending", "approved", "paid", "cancelled", "disputed"], default: "pending" },
    salaryPeriod: { type: String, trim: true },
    teacherAccountId: { type: Schema.Types.ObjectId },
    payoutId: { type: Schema.Types.ObjectId, ref: "TeacherPayout" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const PrivateLessonAttendanceSchema = new Schema<IPrivateLessonAttendance>(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: "PrivateLesson", required: true, unique: true },
    studentAttendance: { type: [{}], default: [] },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    teacherStatus: { type: String, enum: ["present", "absent", "late", "replacement_teacher", "cancelled_by_teacher", "pending"], default: "pending" },
    teacherCheckInTime: { type: Date },
    teacherCheckOutTime: { type: Date },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, trim: true },
    modificationHistory: { type: [{}], default: [] },
  },
  { timestamps: true }
);

const PrivateLessonPerformanceSchema = new Schema<IPrivateLessonPerformance>(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: "PrivateLesson", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    subject: { type: String, required: true, trim: true },
    academicSeason: { type: String, trim: true },
    objectives: { type: String, trim: true },
    topicsCovered: { type: String, trim: true },
    homework: { type: String, trim: true },
    studentUnderstanding: { type: String, trim: true },
    studentParticipation: { type: String, trim: true },
    teacherEvaluation: { type: String, trim: true },
    progressScore: { type: Number, min: 0, max: 100 },
    recommendations: { type: String, trim: true },
    nextLessonPlan: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PrivateLessonSchema.index({ teacherId: 1, startAt: 1, endAt: 1, status: 1 });
PrivateLessonSchema.index({ "students.studentId": 1, startAt: 1, endAt: 1, status: 1 });
PrivateLessonSchema.index({ room: 1, startAt: 1, endAt: 1, status: 1 });
PrivateLessonSchema.index({ subject: 1, academicLevel: 1, academicSeason: 1 });
PrivateLessonSchema.index({ status: 1, paymentStatus: 1, "compensation.status": 1 });
PrivateLessonSchema.index({ seriesId: 1, recurringIndex: 1 });
PrivateLessonSchema.index({ subject: "text", academicLevel: "text", room: "text", "students.name": "text" });
PrivateLessonSeriesSchema.index({ teacherId: 1, startDate: 1, status: 1 });
PrivateLessonPricingSchema.index({ configurationType: 1, teacherId: 1, academicLevel: 1, subject: 1, isActive: 1, effectiveDate: -1 });
TeacherLessonCompensationSchema.index({ teacherId: 1, status: 1, paymentStatus: 1 });
PrivateLessonAttendanceSchema.index({ teacherId: 1, createdAt: -1 });
PrivateLessonNoteSchema.index({ lessonId: 1, createdAt: -1 });
PrivateLessonPerformanceSchema.index({ lessonId: 1, studentId: 1 });

export const PrivateLesson: Model<IPrivateLesson> =
  mongoose.models.PrivateLesson ?? mongoose.model<IPrivateLesson>("PrivateLesson", PrivateLessonSchema);

export const PrivateLessonSeries: Model<IPrivateLessonSeries> =
  mongoose.models.PrivateLessonSeries ?? mongoose.model<IPrivateLessonSeries>("PrivateLessonSeries", PrivateLessonSeriesSchema);

export const PrivateLessonPricing: Model<IPrivateLessonPricing> =
  mongoose.models.PrivateLessonPricing ?? mongoose.model<IPrivateLessonPricing>("PrivateLessonPricing", PrivateLessonPricingSchema);

export const TeacherLessonCompensation: Model<ITeacherLessonCompensation> =
  mongoose.models.TeacherLessonCompensation ?? mongoose.model<ITeacherLessonCompensation>("TeacherLessonCompensation", TeacherLessonCompensationSchema);

export const PrivateLessonAttendance: Model<IPrivateLessonAttendance> =
  mongoose.models.PrivateLessonAttendance ?? mongoose.model<IPrivateLessonAttendance>("PrivateLessonAttendance", PrivateLessonAttendanceSchema);

export const PrivateLessonPerformance: Model<IPrivateLessonPerformance> =
  mongoose.models.PrivateLessonPerformance ?? mongoose.model<IPrivateLessonPerformance>("PrivateLessonPerformance", PrivateLessonPerformanceSchema);

export const PrivateLessonNote = mongoose.models.PrivateLessonNote ?? mongoose.model("PrivateLessonNote", PrivateLessonNoteSchema);
