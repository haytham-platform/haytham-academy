import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("messages.view");
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    if (body.isRead === undefined) {
      return errorResponse("إجراء غير مسموح", 403);
    }

    await connectDB();

    const message = await ContactMessage.findByIdAndUpdate(
      id,
      { isRead: body.isRead },
      { new: true }
    );

    if (!message) return errorResponse("الرسالة غير موجودة", 404);

    return successResponse({ message });
  } catch (error) {
    console.error("Admin message PUT:", error);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("messages.manage");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const message = await ContactMessage.findByIdAndDelete(id);
    if (!message) return errorResponse("الرسالة غير موجودة", 404);

    return successResponse({ message: "تم حذف الرسالة بنجاح" });
  } catch (error) {
    console.error("Admin message DELETE:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
