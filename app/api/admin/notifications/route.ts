import Notification from "@/models/Notification";
import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { createNotification, formatNotification } from "@/lib/notifications";

export async function GET(req: Request) {
  const { user, error } = await requirePermission("notifications.view");
  if (error) return error;
  await connectDB();
  const params = new URL(req.url).searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 25)));
  const filter = {
    $or: [{ userId: user!._id }, { audienceRoles: user!.role }, { audienceRoles: { $size: 0 }, userId: { $exists: false } }],
  };
  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);
  return successResponse({
    notifications: notifications.map((item) => formatNotification(item)),
    unreadCount: notifications.filter((item) => !(item.readBy || []).some((id) => id.toString() === user!._id)).length,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), hasPrev: page > 1, hasNext: page * limit < total },
  });
}

export async function POST(req: Request) {
  const { user, error } = await requirePermission("notifications.send_system");
  if (error) return error;
  try {
    const body = await req.json();
    const notification = await createNotification({
      title: String(body.title || "إشعار إداري"),
      message: String(body.message || ""),
      type: body.type || "info",
      domain: "system",
      audienceRoles: Array.isArray(body.audienceRoles) ? body.audienceRoles : ["admin", "deputy", "secretary"],
      createdBy: user!._id,
    });
    return successResponse({ notification: formatNotification(notification) }, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر إنشاء الإشعار", 400);
  }
}
