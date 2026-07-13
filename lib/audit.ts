import mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";
import FinancialAuditLog from "@/models/FinancialAuditLog";
import { connectDB } from "@/lib/db";

export async function recordAudit(params: {
  userId: string;
  action: string;
  recordType: string;
  recordId?: string;
  metadata?: Record<string, unknown>;
}) {
  await connectDB();
  await AuditLog.create({
    userId: params.userId,
    action: params.action,
    recordType: params.recordType,
    recordId:
      params.recordId && mongoose.Types.ObjectId.isValid(params.recordId)
        ? params.recordId
        : undefined,
    metadata: params.metadata ?? {},
  });
}

export async function recordFinancialAudit(params: {
  userId: string;
  action: string;
  recordType: string;
  recordId?: string;
  metadata?: Record<string, unknown>;
}) {
  await connectDB();
  await FinancialAuditLog.create({
    userId: params.userId,
    action: params.action,
    recordType: params.recordType,
    recordId:
      params.recordId && mongoose.Types.ObjectId.isValid(params.recordId)
        ? params.recordId
        : undefined,
    metadata: params.metadata ?? {},
  });
}
