import Notification from "@/models/Notification";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requirePermission("notifications.view");
  if (error) return error;
  await connectDB();
  await Notification.updateOne({ _id: (await params).id }, { $addToSet: { readBy: user!._id } });
  return successResponse({ message: "تم تعليم الإشعار كمقروء" });
}
