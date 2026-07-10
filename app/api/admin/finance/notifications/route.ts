import Notification from "@/models/Notification";
import { connectDB } from "@/lib/db";
import { requireFinance } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const { user, error } = await requireFinance();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    await connectDB();

    const filter: Record<string, unknown> = {
      domain: "finance",
      $or: [{ audienceRoles: user!.role }, { userId: user!._id }],
    };
    if (unreadOnly) {
      filter.readBy = { $ne: user!._id };
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return successResponse({
      notifications: notifications.map((n) => formatNotification(n)),
    });
  } catch (err) {
    console.error("Finance notifications GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
