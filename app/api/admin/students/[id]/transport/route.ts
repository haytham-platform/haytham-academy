import { connectDB } from "@/lib/db";
import TransportSubscription from "@/models/TransportSubscription";
import { requireTransportAccess } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatSubscription } from "@/lib/transport";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireTransportAccess();
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const subscription = await TransportSubscription.findOne({
      studentId: id,
      status: { $in: ["active", "paused"] },
      endDate: { $gte: new Date() },
    })
      .sort({ createdAt: -1 })
      .populate("studentId", "name phone")
      .populate({
        path: "busId",
        populate: [
          { path: "driverId", select: "name phone" },
          { path: "routeId", select: "name description" },
        ],
      })
      .lean();

    const allSubscriptions = await TransportSubscription.find({ studentId: id })
      .populate({
        path: "busId",
        populate: [{ path: "routeId", select: "name" }],
      })
      .sort({ createdAt: -1 })
      .lean();

    return successResponse({
      hasTransport: Boolean(subscription),
      subscription: subscription ? formatSubscription(subscription) : null,
      subscriptions: allSubscriptions.map((s) => formatSubscription(s)),
    });
  } catch (err) {
    console.error("Student transport GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
