import { connectDB } from "@/lib/db";
import Driver from "@/models/Driver";
import { requireTransportAccess, requireTransportManage, requireTransportDelete } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatDriver } from "@/lib/transport";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireTransportAccess();
    if (error) return error;

    const { id } = await params;
    await connectDB();
    const driver = await Driver.findOne({ _id: id, deletedAt: null }).lean();
    if (!driver) return errorResponse("السائق غير موجود", 404);

    return successResponse({ driver: formatDriver(driver) });
  } catch (err) {
    console.error("Transport driver GET:", err);
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
    if (body.phone !== undefined) updates.phone = body.phone.trim();
    if (body.status !== undefined) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || "";

    const driver = await Driver.findOneAndUpdate({ _id: id, deletedAt: null }, updates, { returnDocument: "after" });
    if (!driver) return errorResponse("السائق غير موجود", 404);

    return successResponse({ driver: formatDriver(driver) });
  } catch (err) {
    console.error("Transport driver PUT:", err);
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

    const driver = await Driver.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { deletedAt: new Date(), status: "inactive" },
      { returnDocument: "after" }
    );
    if (!driver) return errorResponse("السائق غير موجود", 404);

    return successResponse({ message: "تم حذف السائق", driver: formatDriver(driver) });
  } catch (err) {
    console.error("Transport driver DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
