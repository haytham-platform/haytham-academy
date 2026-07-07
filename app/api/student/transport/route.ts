import { connectDB } from "@/lib/db";
import TransportSubscription from "@/models/TransportSubscription";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatSubscription } from "@/lib/transport";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") {
      return errorResponse("غير مصرح", 401);
    }

    await connectDB();

    const subscription = await TransportSubscription.findOne({
      studentId: user._id,
      status: { $in: ["active", "paused"] },
      endDate: { $gte: new Date() },
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "busId",
        populate: [
          { path: "driverId", select: "name phone" },
          { path: "routeId", select: "name description" },
        ],
      })
      .lean();

    return successResponse({
      hasTransport: Boolean(subscription),
      subscription: subscription ? formatSubscription(subscription) : null,
    });
  } catch (err) {
    console.error("Student transport GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
