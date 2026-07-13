import { connectDB } from "@/lib/db";
import Route from "@/models/Route";
import { requireTransportAccess, requireTransportManage, requireTransportDelete } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatRoute } from "@/lib/transport";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireTransportAccess();
    if (error) return error;

    const { id } = await params;
    await connectDB();
    const route = await Route.findOne({ _id: id, deletedAt: null }).lean();
    if (!route) return errorResponse("الخط غير موجود", 404);

    return successResponse({ route: formatRoute(route) });
  } catch (err) {
    console.error("Transport route GET:", err);
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

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || "";
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || "";

    const route = await Route.findOneAndUpdate({ _id: id, deletedAt: null }, updates, { returnDocument: "after" });
    if (!route) return errorResponse("الخط غير موجود", 404);

    return successResponse({ route: formatRoute(route) });
  } catch (err) {
    console.error("Transport route PUT:", err);
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

    const route = await Route.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { deletedAt: new Date(), status: "inactive" },
      { returnDocument: "after" }
    );
    if (!route) return errorResponse("الخط غير موجود", 404);

    return successResponse({ message: "تم حذف الخط", route: formatRoute(route) });
  } catch (err) {
    console.error("Transport route DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
