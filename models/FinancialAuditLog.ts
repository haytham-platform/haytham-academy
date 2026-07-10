import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export interface IFinancialAuditLog extends Document {
  userId: Types.ObjectId;
  action: string;
  recordType: string;
  recordId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const FinancialAuditLogSchema = new Schema<IFinancialAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, trim: true, index: true },
    recordType: { type: String, required: true, trim: true, index: true },
    recordId: { type: Schema.Types.ObjectId, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FinancialAuditLogSchema.index({ createdAt: -1 });
FinancialAuditLogSchema.index({ recordType: 1, recordId: 1, createdAt: -1 });

const FinancialAuditLog: Model<IFinancialAuditLog> =
  mongoose.models.FinancialAuditLog ??
  mongoose.model<IFinancialAuditLog>("FinancialAuditLog", FinancialAuditLogSchema);

export default FinancialAuditLog;
