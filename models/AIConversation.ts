import mongoose, { Schema, type Document, type Model, Types } from "mongoose";
import type { UserRole } from "@/types";

export type AIConversationStatus = "active" | "archived";
export type AIConversationScope = "admin" | "teacher" | "parent" | "student";

export interface IAIMessage {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface IAIConversation extends Document {
  userId: Types.ObjectId;
  userRole: UserRole;
  scope: AIConversationScope;
  title: string;
  status: AIConversationStatus;
  provider?: string;
  modelName?: string;
  messages: IAIMessage[];
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AIMessageSchema = new Schema<IAIMessage>(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const AIConversationSchema = new Schema<IAIConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userRole: { type: String, required: true },
    scope: { type: String, enum: ["admin", "teacher", "parent", "student"], required: true, index: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    provider: { type: String, trim: true },
    modelName: { type: String, trim: true },
    messages: { type: [AIMessageSchema], default: [] },
    lastError: { type: String, trim: true },
  },
  { timestamps: true }
);

AIConversationSchema.index({ userId: 1, updatedAt: -1 });
AIConversationSchema.index({ userId: 1, scope: 1, status: 1 });

const AIConversation: Model<IAIConversation> =
  mongoose.models.AIConversation ?? mongoose.model<IAIConversation>("AIConversation", AIConversationSchema);

export default AIConversation;
