import { connectDB } from "@/lib/db";
import Bus from "@/models/Bus";
import User from "@/models/User";
import TransportSubscription from "@/models/TransportSubscription";
import { requireTransportAccess, requireTransportWrite } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { formatSubscription, syncSubscriptionStatus } from "@/lib/transport";
import { validateDate } from "@/lib/finance";
import { buildPaginationMeta, parsePagination, parseSort } from "@/lib/pagination";
import type { TransportSubscriptionStatus } from "@/lib/transport-labels";

function buildFilter(searchParams: URLSearchParams) {
  const filter: Record<string, unknown> = {};
  const status = searchParams.get("status");
  const studentId = searchParams.get("studentId");
  const busId = searchParams.get("busId");
  const search = searchParams.get("search")?.trim();

  if (status) filter.status = status;
  if (studentId) filter.studentId = studentId;
  if (busId) filter.busId = busId;

  return { filter, search };
}

export async function GET(request: Request) {
  try {
    const { error } = await requireTransportAccess();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["createdAt", "startDate", "status"], "createdAt");
    const { filter, search } = buildFilter(searchParams);

    await connectDB();

    if (search) {
      const students = await User.find({
        role: "student",
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      filter.studentId = { $in: students.map((s) => s._id) };
    }

    const [rows, total] = await Promise.all([
      TransportSubscription.find(filter)
        .populate("studentId", "name phone")
        .populate({
          path: "busId",
          select: "busName plateNumber capacity",
          populate: [
            { path: "driverId", select: "name phone" },
            { path: "routeId", select: "name" },
          ],
        })
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      TransportSubscription.countDocuments(filter),
    ]);

    return successResponse({
      subscriptions: rows.map((s) => formatSubscription(s)),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Transport subscriptions GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireTransportWrite();
    if (error) return error;

    const body = await request.json();
    const startDate = validateDate(body.startDate);
    const endDate = validateDate(body.endDate);

    if (!body.studentId) return errorResponse("الطالب مطلوب");
    if (!body.busId) return errorResponse("الحافلة مطلوبة");
    if (!startDate || !endDate) return errorResponse("تواريخ الاشتراك غير صالحة");
    if (endDate < startDate) return errorResponse("تاريخ النهاية يجب أن يكون بعد البداية");
    if (!body.pickupPoint?.trim()) return errorResponse("نقطة الصعود مطلوبة");
    if (!body.dropoffPoint?.trim()) return errorResponse("نقطة النزول مطلوبة");

    await connectDB();

    const student = await User.findOne({
      _id: body.studentId,
      role: "student",
      deletedAt: null,
    });
    if (!student) return errorResponse("الطالب غير موجود", 404);

    const bus = await Bus.findOne({ _id: body.busId, deletedAt: null, status: "active" });
    if (!bus) return errorResponse("الحافلة غير موجودة أو غير نشطة", 404);

    const activeSub = await TransportSubscription.findOne({
      studentId: body.studentId,
      status: { $in: ["active", "paused"] },
      endDate: { $gte: new Date() },
    });
    if (activeSub) {
      return errorResponse("الطالب مسجل مسبقاً في خدمة النقل", 409);
    }

    const manualStatus = body.status === "paused" ? "paused" : "active";
    const synced = syncSubscriptionStatus({
      status: manualStatus as TransportSubscriptionStatus,
      startDate,
      endDate,
    });

    const subscription = await TransportSubscription.create({
      studentId: body.studentId,
      busId: body.busId,
      startDate,
      endDate,
      status: synced.status,
      pickupPoint: body.pickupPoint.trim(),
      dropoffPoint: body.dropoffPoint.trim(),
      notes: body.notes?.trim() || "",
      createdBy: user!._id,
    });

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

    return successResponse({ subscription: formatSubscription(populated ?? subscription.toObject()) }, 201);
  } catch (err) {
    return handleRouteError("Transport subscriptions POST", err);
  }
}
