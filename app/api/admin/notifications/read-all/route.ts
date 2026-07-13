import Notification from "@/models/Notification";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";

export async function POST() {
  const { user, error } = await requirePermission("notifications.view");
  if (error) return error;
  await connectDB();
  await Notification.updateMany(
    { $or: [{ userId: user!._id }, { audienceRoles: user!.role }, { audienceRoles: { $size: 0 }, userId: { $exists: false } }] },
    { $addToSet: { readBy: user!._id } }
  );
  return successResponse({ message: "تم تعليم كل الإشعارات كمقروءة" });
}
