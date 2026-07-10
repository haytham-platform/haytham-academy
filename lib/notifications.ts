import Notification, {
  type NotificationDomain,
  type NotificationType,
} from "@/models/Notification";
import { connectDB } from "@/lib/db";
import type { UserRole } from "@/types";

export async function createNotification(params: {
  title: string;
  message: string;
  type?: NotificationType;
  domain?: NotificationDomain;
  audienceRoles?: UserRole[];
  userId?: string;
  data?: Record<string, unknown>;
  createdBy?: string;
}) {
  await connectDB();
  return Notification.create({
    title: params.title,
    message: params.message,
    type: params.type ?? "info",
    domain: params.domain ?? "system",
    audienceRoles: params.audienceRoles ?? [],
    userId: params.userId || undefined,
    data: params.data,
    createdBy: params.createdBy || undefined,
  });
}

export async function notifyFinance(params: {
  title: string;
  message: string;
  type?: NotificationType;
  data?: Record<string, unknown>;
  createdBy?: string;
}) {
  return createNotification({
    ...params,
    domain: "finance",
    audienceRoles: ["admin", "deputy"],
  });
}

export function formatNotification(notification: {
  _id: { toString(): string };
  title: string;
  message: string;
  type: string;
  domain: string;
  audienceRoles?: string[];
  userId?: { toString(): string } | string;
  readBy?: Array<{ toString(): string } | string>;
  data?: Record<string, unknown>;
  createdAt: Date | string;
}) {
  return {
    _id: notification._id.toString(),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    domain: notification.domain,
    audienceRoles: notification.audienceRoles ?? [],
    userId:
      typeof notification.userId === "string"
        ? notification.userId
        : notification.userId?.toString?.(),
    readBy: (notification.readBy ?? []).map((id) =>
      typeof id === "string" ? id : id.toString()
    ),
    data: notification.data ?? {},
    createdAt: toIso(notification.createdAt),
  };
}

function toIso(value: Date | string | undefined | null) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
