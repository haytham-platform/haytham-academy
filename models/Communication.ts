import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type CommunicationChannel =
  | "in_app"
  | "email"
  | "sms"
  | "whatsapp"
  | "administrative_notice"
  | "phone_call"
  | "guardian_meeting";

export type CommunicationStatus =
  | "draft"
  | "scheduled"
  | "queued"
  | "processing"
  | "sent"
  | "partially_sent"
  | "delivered"
  | "failed"
  | "cancelled"
  | "expired";

export type CommunicationRecipientType =
  | "student"
  | "guardian"
  | "teacher"
  | "employee"
  | "user"
  | "custom";

export interface ICommunication extends Document {
  channel: CommunicationChannel;
  category: string;
  subject?: string;
  content: string;
  arabicContent?: string;
  secondaryContent?: string;
  templateId?: Types.ObjectId;
  recipientScope: {
    type: string;
    ids: string[];
    filters: Record<string, unknown>;
  };
  recipientCount: number;
  duplicateCount: number;
  invalidCount: number;
  optedOutCount: number;
  missingContactCount: number;
  status: CommunicationStatus;
  priority: "low" | "normal" | "high" | "urgent";
  scheduledAt?: Date;
  queuedAt?: Date;
  processingStartedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  expiresAt?: Date;
  retryCount: number;
  maxRetries: number;
  idempotencyKey: string;
  lockToken?: string;
  lockExpiresAt?: Date;
  related: {
    academicSeason?: string;
    studentId?: Types.ObjectId;
    guardianId?: Types.ObjectId;
    teacherId?: Types.ObjectId;
    enrollmentId?: Types.ObjectId;
    attendanceId?: Types.ObjectId;
    paymentId?: Types.ObjectId;
    invoiceId?: Types.ObjectId;
    courseId?: Types.ObjectId;
    className?: string;
    privateLessonId?: Types.ObjectId;
    kindergartenRegistrationId?: Types.ObjectId;
    transportationAssignmentId?: Types.ObjectId;
  };
  attachments: Array<{
    title: string;
    url: string;
    mimeType?: string;
    size?: number;
  }>;
  internalNotes?: string;
  provider?: string;
  providerSummary?: Record<string, unknown>;
  errorSummary?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  cancelledBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICommunicationDelivery extends Document {
  communicationId: Types.ObjectId;
  recipientType: CommunicationRecipientType;
  recipientId?: Types.ObjectId;
  recipientName?: string;
  destination?: string;
  destinationMasked?: string;
  channel: CommunicationChannel;
  provider?: string;
  providerMessageId?: string;
  status: CommunicationStatus | "read" | "unread";
  queuedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  readAt?: Date;
  failureCode?: string;
  failureMessage?: string;
  retryCount: number;
  lastRetryAt?: Date;
  relatedEntity?: {
    type?: string;
    id?: Types.ObjectId;
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICommunicationTemplate extends Document {
  name: string;
  code: string;
  category: string;
  channel: CommunicationChannel;
  subject?: string;
  content: string;
  arabicContent?: string;
  secondaryContent?: string;
  variables: string[];
  isActive: boolean;
  version: number;
  versionHistory: Array<{
    version: number;
    subject?: string;
    content: string;
    arabicContent?: string;
    changedBy?: Types.ObjectId;
    changedAt: Date;
  }>;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICommunicationPreference extends Document {
  ownerType: CommunicationRecipientType;
  ownerId?: Types.ObjectId;
  destinationHash?: string;
  allowInApp: boolean;
  allowEmail: boolean;
  allowSms: boolean;
  allowWhatsapp: boolean;
  preferredChannel?: CommunicationChannel;
  preferredLanguage: "ar" | "fr" | "en";
  quietHours?: {
    enabled: boolean;
    start?: string;
    end?: string;
  };
  optedOut: boolean;
  optOutReason?: string;
  consentDate?: Date;
  consentSource?: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICommunicationProviderSetting extends Document {
  providerType: "email" | "sms" | "whatsapp";
  providerName: string;
  enabled: boolean;
  senderIdentity?: string;
  connectionStatus: "configured" | "missing_config" | "failed" | "unknown";
  lastSuccessfulCheck?: Date;
  lastFailure?: string;
  safeSummary?: Record<string, unknown>;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RelatedSchema = new Schema(
  {
    academicSeason: { type: String, trim: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User" },
    guardianId: { type: Schema.Types.ObjectId, ref: "Guardian" },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher" },
    enrollmentId: { type: Schema.Types.ObjectId, ref: "Enrollment" },
    attendanceId: { type: Schema.Types.ObjectId },
    paymentId: { type: Schema.Types.ObjectId },
    invoiceId: { type: Schema.Types.ObjectId },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    className: { type: String, trim: true },
    privateLessonId: { type: Schema.Types.ObjectId, ref: "PrivateLesson" },
    kindergartenRegistrationId: { type: Schema.Types.ObjectId, ref: "KindergartenRegistration" },
    transportationAssignmentId: { type: Schema.Types.ObjectId },
  },
  { _id: false }
);

const CommunicationSchema = new Schema<ICommunication>(
  {
    channel: { type: String, required: true, index: true },
    category: { type: String, required: true, trim: true, index: true },
    subject: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    arabicContent: { type: String, trim: true },
    secondaryContent: { type: String, trim: true },
    templateId: { type: Schema.Types.ObjectId, ref: "CommunicationTemplate" },
    recipientScope: {
      type: {
        type: String,
        required: true,
        trim: true,
      },
      ids: { type: [String], default: [] },
      filters: { type: Schema.Types.Mixed, default: {} },
    },
    recipientCount: { type: Number, default: 0, min: 0 },
    duplicateCount: { type: Number, default: 0, min: 0 },
    invalidCount: { type: Number, default: 0, min: 0 },
    optedOutCount: { type: Number, default: 0, min: 0 },
    missingContactCount: { type: Number, default: 0, min: 0 },
    status: { type: String, required: true, default: "draft", index: true },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    scheduledAt: { type: Date, index: true },
    queuedAt: Date,
    processingStartedAt: Date,
    sentAt: Date,
    deliveredAt: Date,
    failedAt: Date,
    cancelledAt: Date,
    expiresAt: Date,
    retryCount: { type: Number, default: 0, min: 0 },
    maxRetries: { type: Number, default: 3, min: 0, max: 10 },
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    lockToken: { type: String, trim: true },
    lockExpiresAt: Date,
    related: { type: RelatedSchema, default: () => ({}) },
    attachments: {
      type: [
        {
          title: { type: String, required: true, trim: true },
          url: { type: String, required: true, trim: true },
          mimeType: { type: String, trim: true },
          size: { type: Number, min: 0 },
        },
      ],
      default: [],
    },
    internalNotes: { type: String, trim: true },
    provider: { type: String, trim: true },
    providerSummary: { type: Schema.Types.Mixed, default: {} },
    errorSummary: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const DeliverySchema = new Schema<ICommunicationDelivery>(
  {
    communicationId: { type: Schema.Types.ObjectId, ref: "Communication", required: true, index: true },
    recipientType: { type: String, required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, index: true },
    recipientName: { type: String, trim: true },
    destination: { type: String, trim: true },
    destinationMasked: { type: String, trim: true },
    channel: { type: String, required: true, index: true },
    provider: { type: String, trim: true },
    providerMessageId: { type: String, trim: true },
    status: { type: String, required: true, default: "queued", index: true },
    queuedAt: Date,
    sentAt: Date,
    deliveredAt: Date,
    failedAt: Date,
    readAt: Date,
    failureCode: { type: String, trim: true },
    failureMessage: { type: String, trim: true },
    retryCount: { type: Number, default: 0, min: 0 },
    lastRetryAt: Date,
    relatedEntity: {
      type: { type: String, trim: true },
      id: { type: Schema.Types.ObjectId },
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const TemplateSchema = new Schema<ICommunicationTemplate>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, lowercase: true },
    category: { type: String, required: true, trim: true, index: true },
    channel: { type: String, required: true, index: true },
    subject: { type: String, trim: true },
    content: { type: String, required: true, trim: true },
    arabicContent: { type: String, trim: true },
    secondaryContent: { type: String, trim: true },
    variables: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    version: { type: Number, default: 1, min: 1 },
    versionHistory: {
      type: [
        {
          version: { type: Number, required: true },
          subject: { type: String, trim: true },
          content: { type: String, required: true },
          arabicContent: { type: String },
          changedBy: { type: Schema.Types.ObjectId, ref: "User" },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const PreferenceSchema = new Schema<ICommunicationPreference>(
  {
    ownerType: { type: String, required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, index: true },
    destinationHash: { type: String, trim: true, index: true },
    allowInApp: { type: Boolean, default: true },
    allowEmail: { type: Boolean, default: true },
    allowSms: { type: Boolean, default: true },
    allowWhatsapp: { type: Boolean, default: true },
    preferredChannel: { type: String, trim: true },
    preferredLanguage: { type: String, enum: ["ar", "fr", "en"], default: "ar" },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, trim: true },
      end: { type: String, trim: true },
    },
    optedOut: { type: Boolean, default: false, index: true },
    optOutReason: { type: String, trim: true },
    consentDate: Date,
    consentSource: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const ProviderSettingSchema = new Schema<ICommunicationProviderSetting>(
  {
    providerType: { type: String, required: true, unique: true, enum: ["email", "sms", "whatsapp"] },
    providerName: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: false },
    senderIdentity: { type: String, trim: true },
    connectionStatus: { type: String, enum: ["configured", "missing_config", "failed", "unknown"], default: "unknown" },
    lastSuccessfulCheck: Date,
    lastFailure: { type: String, trim: true },
    safeSummary: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CommunicationSchema.index({ status: 1, scheduledAt: 1, createdAt: -1 });
CommunicationSchema.index({ channel: 1, category: 1, createdAt: -1 });
CommunicationSchema.index({ "related.academicSeason": 1, createdAt: -1 });
CommunicationSchema.index({ subject: "text", content: "text", internalNotes: "text" });
DeliverySchema.index(
  { communicationId: 1, recipientType: 1, recipientId: 1, destination: 1, channel: 1 },
  { unique: true, partialFilterExpression: { destination: { $exists: true } } }
);
DeliverySchema.index({ status: 1, channel: 1, createdAt: -1 });
TemplateSchema.index({ name: "text", code: "text", category: "text", content: "text" });
PreferenceSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true, sparse: true });

export const Communication: Model<ICommunication> =
  mongoose.models.Communication ?? mongoose.model<ICommunication>("Communication", CommunicationSchema);

export const CommunicationDelivery: Model<ICommunicationDelivery> =
  mongoose.models.CommunicationDelivery ??
  mongoose.model<ICommunicationDelivery>("CommunicationDelivery", DeliverySchema);

export const CommunicationTemplate: Model<ICommunicationTemplate> =
  mongoose.models.CommunicationTemplate ??
  mongoose.model<ICommunicationTemplate>("CommunicationTemplate", TemplateSchema);

export const CommunicationPreference: Model<ICommunicationPreference> =
  mongoose.models.CommunicationPreference ??
  mongoose.model<ICommunicationPreference>("CommunicationPreference", PreferenceSchema);

export const CommunicationProviderSetting: Model<ICommunicationProviderSetting> =
  mongoose.models.CommunicationProviderSetting ??
  mongoose.model<ICommunicationProviderSetting>("CommunicationProviderSetting", ProviderSettingSchema);
