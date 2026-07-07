import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const { error } = await requirePermission("messages.view");
    if (error) return error;

    await connectDB();

    const messages = await ContactMessage.find()
      .sort({ createdAt: -1 })
      .lean();

    return successResponse({
      messages: messages.map((m) => ({
        _id: m._id.toString(),
        name: m.name,
        phone: m.phone,
        message: m.message,
        isRead: m.isRead,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin messages GET:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
