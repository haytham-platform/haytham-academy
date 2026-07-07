import { connectDB } from "@/lib/db";
import Bus from "@/models/Bus";
import TransportSubscription from "@/models/TransportSubscription";
import { requireTransportAccess } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatBus, formatSubscription, toCsv, csvResponse } from "@/lib/transport";
import type { TransportSubscriptionStatus } from "@/lib/transport-labels";

export async function GET(request: Request) {
  try {
    const { error } = await requireTransportAccess();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const busId = searchParams.get("busId");
    const status = searchParams.get("status");
    const exportCsv = searchParams.get("export") === "csv";

    if (!busId) return errorResponse("معرّف الحافلة مطلوب");

    await connectDB();

    const bus = await Bus.findOne({ _id: busId, deletedAt: null })
      .populate("driverId", "name phone")
      .populate("routeId", "name description")
      .lean();
    if (!bus) return errorResponse("الحافلة غير موجودة", 404);

    const filter: Record<string, unknown> = { busId };
    if (status && ["active", "paused", "expired"].includes(status)) {
      filter.status = status as TransportSubscriptionStatus;
    } else {
      filter.status = { $in: ["active", "paused"] };
    }

    const passengers = await TransportSubscription.find(filter)
      .populate("studentId", "name phone")
      .populate("busId", "busName plateNumber")
      .sort({ pickupPoint: 1, "studentId.name": 1 })
      .lean();

    const formatted = passengers.map((p) => formatSubscription(p));
    const report = {
      bus: formatBus(bus),
      passengerCount: formatted.length,
      capacity: bus.capacity,
      passengers: formatted,
    };

    if (exportCsv) {
      const csv = toCsv(
        ["الطالب", "الهاتف", "نقطة الصعود", "نقطة النزول", "من", "إلى", "الحالة", "ملاحظات"],
        passengers.map((p) => [
          (p.studentId as { name?: string })?.name ?? "",
          (p.studentId as { phone?: string })?.phone ?? "",
          p.pickupPoint,
          p.dropoffPoint,
          new Date(p.startDate).toLocaleDateString("ar-DZ"),
          new Date(p.endDate).toLocaleDateString("ar-DZ"),
          p.status,
          p.notes ?? "",
        ])
      );
      return csvResponse(`passengers-${bus.busName}.csv`, csv);
    }

    return successResponse({ report });
  } catch (err) {
    console.error("Transport passengers GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
