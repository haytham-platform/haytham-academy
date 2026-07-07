import { connectDB } from "@/lib/db";
import Bus from "@/models/Bus";
import Driver from "@/models/Driver";
import Route from "@/models/Route";
import { requireTransportAccess, requireTransportManage, requireTransportDelete } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatBus } from "@/lib/transport";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireTransportAccess();
    if (error) return error;

    const { id } = await params;
    await connectDB();
    const bus = await Bus.findOne({ _id: id, deletedAt: null })
      .populate("driverId", "name phone")
      .populate("routeId", "name description")
      .lean();
    if (!bus) return errorResponse("الحافلة غير موجودة", 404);

    return successResponse({ bus: formatBus(bus) });
  } catch (err) {
    console.error("Transport bus GET:", err);
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

    if (body.driverId) {
      const driver = await Driver.findOne({ _id: body.driverId, deletedAt: null, status: "active" });
      if (!driver) return errorResponse("السائق غير موجود أو غير نشط", 404);
    }
    if (body.routeId) {
      const route = await Route.findOne({ _id: body.routeId, deletedAt: null, status: "active" });
      if (!route) return errorResponse("خط السير غير موجود أو غير نشط", 404);
    }

    const updates: Record<string, unknown> = {};
    if (body.busName !== undefined) updates.busName = body.busName.trim();
    if (body.plateNumber !== undefined) updates.plateNumber = body.plateNumber.trim();
    if (body.driverId !== undefined) updates.driverId = body.driverId;
    if (body.routeId !== undefined) updates.routeId = body.routeId;
    if (body.capacity !== undefined) updates.capacity = Number(body.capacity);
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || "";

    const bus = await Bus.findOneAndUpdate({ _id: id, deletedAt: null }, updates, { new: true })
      .populate("driverId", "name phone")
      .populate("routeId", "name description");
    if (!bus) return errorResponse("الحافلة غير موجودة", 404);

    return successResponse({ bus: formatBus(bus) });
  } catch (err) {
    console.error("Transport bus PUT:", err);
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

    const bus = await Bus.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { deletedAt: new Date(), status: "inactive" },
      { new: true }
    );
    if (!bus) return errorResponse("الحافلة غير موجودة", 404);

    return successResponse({ message: "تم حذف الحافلة", bus: formatBus(bus) });
  } catch (err) {
    console.error("Transport bus DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
