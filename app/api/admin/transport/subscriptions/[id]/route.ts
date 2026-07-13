import { connectDB } from "@/lib/db";
import TransportSubscription from "@/models/TransportSubscription";
import Bus from "@/models/Bus";
import {
  requireTransportAccess,
  requireTransportManage,
  requireTransportDelete,
} from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatSubscription, syncSubscriptionStatus } from "@/lib/transport";
import { validateDate } from "@/lib/finance";
import type { TransportSubscriptionStatus } from "@/lib/transport-labels";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireTransportAccess();
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const subscription = await TransportSubscription.findById(id)
      .populate("studentId", "name phone")
      .populate({
        path: "busId",
        populate: [
          { path: "driverId", select: "name phone" },
          { path: "routeId", select: "name description" },
        ],
      })
      .lean();

    if (!subscription) return errorResponse("الاشتراك غير موجود", 404);

    return successResponse({ subscription: formatSubscription(subscription) });
  } catch (err) {
    console.error("Transport subscription GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireTransportManage();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    await connectDB();

    const subscription = await TransportSubscription.findById(id);
    if (!subscription) return errorResponse("الاشتراك غير موجود", 404);

    if (body.startDate) {
      const d = validateDate(body.startDate);
      if (d) subscription.startDate = d;
    }
    if (body.endDate) {
      const d = validateDate(body.endDate);
      if (d) subscription.endDate = d;
    }
    if (body.busId) {
      const bus = await Bus.findOne({ _id: body.busId, deletedAt: null, status: "active" });
      if (!bus) return errorResponse("الحافلة غير موجودة أو غير نشطة", 404);
      subscription.busId = body.busId;
    }
    if (body.pickupPoint) subscription.pickupPoint = body.pickupPoint.trim();
    if (body.dropoffPoint) subscription.dropoffPoint = body.dropoffPoint.trim();
    if (body.notes !== undefined) subscription.notes = body.notes?.trim() || "";
    if (body.status && ["active", "paused", "expired"].includes(body.status)) {
      subscription.status = body.status as TransportSubscriptionStatus;
    }

    const synced = syncSubscriptionStatus({
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
    });
    subscription.status = synced.status;
    await subscription.save();

    const populated = await TransportSubscription.findById(subscription._id)
      .populate("studentId", "name phone")
      .populate({
        path: "busId",
        populate: [
          { path: "driverId", select: "name phone" },
          { path: "routeId", select: "name" },
        ],
      })
      .lean();

    return successResponse({ subscription: formatSubscription(populated!) });
  } catch (err) {
    console.error("Transport subscription PUT:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireTransportDelete();
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const subscription = await TransportSubscription.findByIdAndUpdate(
      id,
      { status: "expired", endDate: new Date() },
      { returnDocument: "after" }
    );
    if (!subscription) return errorResponse("الاشتراك غير موجود", 404);

    return successResponse({
      message: "تم إنهاء الاشتراك",
      subscription: formatSubscription(subscription),
    });
  } catch (err) {
    console.error("Transport subscription DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
