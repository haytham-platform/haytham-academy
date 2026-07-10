import mongoose, { Schema, type Document, type Model, Types } from "mongoose";
import type { UserRole } from "@/types";

export type NotificationType = "info" | "success" | "warning" | "danger";
export type NotificationDomain = "finance" | "system" | "student" | "transport";

export interface INotification extends Document {
  title: string;
  message: string;
  type: NotificationType;
  domain: NotificationDomain;
  audienceRoles: UserRole[];
  userId?: Types.ObjectId;
  data?: Record<string, unknown>;
  readBy: Types.ObjectId[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["info", "success", "warning", "danger"],
      default: "info",
    },
    domain: {
      type: String,
      enum: ["finance", "system", "student", "transport"],
      default: "system",
    },
    audienceRoles: {
      type: [String],
      enum: ["admin", "deputy", "secretary", "teacher", "student"],
      default: [],
    },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    data: { type: Schema.Types.Mixed },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

NotificationSchema.index({ domain: 1, createdAt: -1 });
NotificationSchema.index({ audienceRoles: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification ??
  mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
