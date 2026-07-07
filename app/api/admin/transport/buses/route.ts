import { connectDB } from "@/lib/db";
import Bus from "@/models/Bus";
import Driver from "@/models/Driver";
import Route from "@/models/Route";
import { requireTransportAccess, requireTransportManage } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatBus } from "@/lib/transport";
import { buildPaginationMeta, parsePagination, parseSort } from "@/lib/pagination";

function buildBusFilter(searchParams: URLSearchParams) {
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");
  const filter: Record<string, unknown> = { deletedAt: null };
  if (status && ["active", "inactive", "maintenance"].includes(status)) {
    filter.status = status;
  }
  return { filter, search };
}

export async function GET(request: Request) {
  try {
    const { error } = await requireTransportAccess();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["busName", "createdAt"], "createdAt");
    const { filter, search } = buildBusFilter(searchParams);

    await connectDB();

    if (search) {
      const [drivers, routes] = await Promise.all([
        Driver.find({ deletedAt: null, name: { $regex: search, $options: "i" } }).select("_id"),
        Route.find({ deletedAt: null, name: { $regex: search, $options: "i" } }).select("_id"),
      ]);
      filter.$or = [
        { busName: { $regex: search, $options: "i" } },
        { plateNumber: { $regex: search, $options: "i" } },
        { driverId: { $in: drivers.map((d) => d._id) } },
        { routeId: { $in: routes.map((r) => r._id) } },
      ];
    }

    const [buses, total] = await Promise.all([
      Bus.find(filter)
        .populate("driverId", "name phone")
        .populate("routeId", "name description")
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Bus.countDocuments(filter),
    ]);

    return successResponse({
      buses: buses.map((b) => formatBus(b)),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Transport buses GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requireTransportManage();
    if (error) return error;

    const body = await request.json();
    const { busName, plateNumber, driverId, routeId, capacity } = body;

    if (!busName?.trim()) return errorResponse("اسم الحافلة مطلوب");
    if (!plateNumber?.trim()) return errorResponse("رقم اللوحة مطلوب");
    if (!driverId) return errorResponse("السائق مطلوب");
    if (!routeId) return errorResponse("خط السير مطلوب");
    if (!capacity || capacity < 1) return errorResponse("السعة مطلوبة");

    await connectDB();

    const [driver, route, exists] = await Promise.all([
      Driver.findOne({ _id: driverId, deletedAt: null, status: "active" }),
      Route.findOne({ _id: routeId, deletedAt: null, status: "active" }),
      Bus.findOne({ plateNumber: plateNumber.trim(), deletedAt: null }),
    ]);

    if (!driver) return errorResponse("السائق غير موجود أو غير نشط", 404);
    if (!route) return errorResponse("خط السير غير موجود أو غير نشط", 404);
    if (exists) return errorResponse("رقم اللوحة مسجل مسبقاً", 409);

    const bus = await Bus.create({
      busName: busName.trim(),
      plateNumber: plateNumber.trim(),
      driverId,
      routeId,
      capacity: Number(capacity),
      status: body.status || "active",
      notes: body.notes?.trim() || "",
    });

    const populated = await Bus.findById(bus._id)
      .populate("driverId", "name phone")
      .populate("routeId", "name description")
      .lean();

    return successResponse({ bus: formatBus(populated!) }, 201);
  } catch (err) {
    console.error("Transport buses POST:", err);
    const message = err instanceof Error ? err.message : "حدث خطأ";
    return errorResponse(message.includes("duplicate") ? "رقم اللوحة مسجل مسبقاً" : "حدث خطأ", 500);
  }
}
