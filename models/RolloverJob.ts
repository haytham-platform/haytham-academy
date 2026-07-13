import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type RolloverAction =
  | "promote"
  | "repeat"
  | "transfer"
  | "graduate"
  | "withdraw"
  | "archive"
  | "keep"
  | "move_class"
  | "move_group"
  | "exclude";

export type RolloverJobStatus =
  | "draft"
  | "previewed"
  | "ready"
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancelled";

export type RolloverItemStatus = "pending" | "completed" | "failed" | "skipped";

export interface IRolloverConflict {
  code: string;
  severity: "blocking" | "warning";
  message: string;
}

export interface IRolloverJobItem {
  studentId: Types.ObjectId;
  sourceEnrollmentId?: Types.ObjectId;
  targetEnrollmentId?: Types.ObjectId;
  sourceAcademicLevel?: string;
  targetAcademicLevel?: string;
  sourceClass?: string;
  targetClass?: string;
  sourceGroup?: string;
  targetGroup?: string;
  enrollmentType?: string;
  action: RolloverAction;
  reason?: string;
  notes?: string;
  status: RolloverItemStatus;
  preview: Record<string, unknown>;
  conflicts: IRolloverConflict[];
  warnings: IRolloverConflict[];
  error?: string;
  executedAt?: Date;
}

export interface IRolloverJob extends Document {
  sourceSeason: string;
  targetSeason: string;
  sourceSeasonId?: Types.ObjectId;
  targetSeasonId?: Types.ObjectId;
  scope: Record<string, unknown>;
  action: RolloverAction;
  idempotencyKey: string;
  status: RolloverJobStatus;
  items: IRolloverJobItem[];
  totalStudents: number;
  completed: number;
  failed: number;
  skipped: number;
  warnings: number;
  overrideWarnings: boolean;
  overrideReason?: string;
  errorSummary?: string;
  startedBy?: Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  executedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConflictSchema = new Schema<IRolloverConflict>(
  {
    code: { type: String, required: true, trim: true },
    severity: { type: String, enum: ["blocking", "warning"], required: true },
    message: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const RolloverJobItemSchema = new Schema<IRolloverJobItem>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceEnrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment" },
    targetEnrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment" },
    sourceAcademicLevel: { type: String, trim: true },
    targetAcademicLevel: { type: String, trim: true },
    sourceClass: { type: String, trim: true },
    targetClass: { type: String, trim: true },
    sourceGroup: { type: String, trim: true },
    targetGroup: { type: String, trim: true },
    enrollmentType: { type: String, trim: true },
    action: { type: String, required: true },
    reason: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ["pending", "completed", "failed", "skipped"], default: "pending" },
    preview: { type: Schema.Types.Mixed, default: {} },
    conflicts: { type: [ConflictSchema], default: [] },
    warnings: { type: [ConflictSchema], default: [] },
    error: { type: String, trim: true },
    executedAt: { type: Date },
  },
  { _id: true }
);

const RolloverJobSchema = new Schema<IRolloverJob>(
  {
    sourceSeason: { type: String, required: true, trim: true, index: true },
    targetSeason: { type: String, required: true, trim: true, index: true },
    sourceSeasonId: { type: Schema.Types.ObjectId, ref: "AcademicSeason" },
    targetSeasonId: { type: Schema.Types.ObjectId, ref: "AcademicSeason" },
    scope: { type: Schema.Types.Mixed, default: {} },
    action: { type: String, required: true },
    idempotencyKey: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "previewed", "ready", "running", "completed", "completed_with_warnings", "failed", "cancelled"],
      default: "draft",
      index: true,
    },
    items: { type: [RolloverJobItemSchema], default: [] },
    totalStudents: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    overrideWarnings: { type: Boolean, default: false },
    overrideReason: { type: String, trim: true },
    errorSummary: { type: String, trim: true },
    startedBy: { type: Schema.Types.ObjectId, ref: "User" },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    executedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

RolloverJobSchema.index({ idempotencyKey: 1 }, { unique: true });
RolloverJobSchema.index({ sourceSeason: 1, targetSeason: 1, status: 1 });
RolloverJobSchema.index({ "items.studentId": 1, targetSeason: 1 });
RolloverJobSchema.index({ createdAt: -1 });

const RolloverJob: Model<IRolloverJob> =
  mongoose.models.RolloverJob ?? mongoose.model<IRolloverJob>("RolloverJob", RolloverJobSchema);

export default RolloverJob;
