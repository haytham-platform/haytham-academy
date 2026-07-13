import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type AcademicSeasonStatus = "draft" | "upcoming" | "active" | "closed" | "archived";

export interface ISeasonConfigurationSnapshot {
  academicLevels: string[];
  classes: string[];
  groups: string[];
  courseIds: Types.ObjectId[];
  feeConfigIds: Types.ObjectId[];
  routeIds: Types.ObjectId[];
  kindergartenGroups: string[];
  teacherAssignmentTemplates: Record<string, unknown>[];
  scheduleTemplates: Record<string, unknown>[];
}

export interface IAcademicSeason extends Document {
  name: string;
  code: string;
  startDate: Date;
  endDate: Date;
  status: AcademicSeasonStatus;
  isCurrent: boolean;
  isOpenForRegistration: boolean;
  isClosed: boolean;
  isArchived: boolean;
  description?: string;
  notes?: string;
  configuration?: ISeasonConfigurationSnapshot;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  closedBy?: Types.ObjectId;
  closedAt?: Date;
  archivedBy?: Types.ObjectId;
  archivedAt?: Date;
  archiveReason?: string;
  restoredBy?: Types.ObjectId;
  restoredAt?: Date;
  reopenedBy?: Types.ObjectId;
  reopenedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConfigurationSchema = new Schema<ISeasonConfigurationSnapshot>(
  {
    academicLevels: { type: [String], default: [] },
    classes: { type: [String], default: [] },
    groups: { type: [String], default: [] },
    courseIds: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    feeConfigIds: [{ type: Schema.Types.ObjectId, ref: "StudentFeeConfig" }],
    routeIds: [{ type: Schema.Types.ObjectId, ref: "Route" }],
    kindergartenGroups: { type: [String], default: [] },
    teacherAssignmentTemplates: { type: [{}], default: [] },
    scheduleTemplates: { type: [{}], default: [] },
  },
  { _id: false }
);

const AcademicSeasonSchema = new Schema<IAcademicSeason>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "upcoming", "active", "closed", "archived"],
      default: "draft",
      index: true,
    },
    isCurrent: { type: Boolean, default: false },
    isOpenForRegistration: { type: Boolean, default: false },
    isClosed: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false, index: true },
    description: { type: String, trim: true },
    notes: { type: String, trim: true },
    configuration: { type: ConfigurationSchema, default: () => ({}) },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
    closedAt: { type: Date },
    archivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    archivedAt: { type: Date },
    archiveReason: { type: String, trim: true },
    restoredBy: { type: Schema.Types.ObjectId, ref: "User" },
    restoredAt: { type: Date },
    reopenedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reopenedAt: { type: Date },
  },
  { timestamps: true }
);

AcademicSeasonSchema.pre("validate", function () {
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    throw new Error("تاريخ بداية الموسم يجب أن يسبق تاريخ نهايته");
  }
  this.isClosed = this.status === "closed" || this.status === "archived";
  this.isArchived = this.status === "archived";
  if (this.status === "active") this.isCurrent = true;
  if (this.isArchived) this.isOpenForRegistration = false;
});

AcademicSeasonSchema.index({ code: 1 }, { unique: true });
AcademicSeasonSchema.index(
  { isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);
AcademicSeasonSchema.index({ status: 1, startDate: -1 });
AcademicSeasonSchema.index({ isArchived: 1, archivedAt: -1 });

const AcademicSeason: Model<IAcademicSeason> =
  mongoose.models.AcademicSeason ??
  mongoose.model<IAcademicSeason>("AcademicSeason", AcademicSeasonSchema);

export default AcademicSeason;
