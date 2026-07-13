import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import Notification from "@/models/Notification";
import { errorResponse, successResponse } from "@/lib/api-response";
import { formatNotification } from "@/lib/notifications";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") return errorResponse("غير مصرح", 401);

    await connectDB();
    const notifications = await Notification.find({
      domain: { $in: ["student", "system", "transport"] },
      $or: [{ userId: user._id }, { audienceRoles: "student" }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return successResponse({
      notifications: notifications.map((notification) => {
        const formatted = formatNotification(notification);
        return {
          ...formatted,
          read: formatted.readBy.includes(user._id),
        };
      }),
    });
  } catch (error) {
    console.error("Student notifications GET:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
