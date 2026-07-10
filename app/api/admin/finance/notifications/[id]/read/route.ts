import Notification from "@/models/Notification";
import { connectDB } from "@/lib/db";
import { requireFinance } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireFinance();
    if (error) return error;

    const { id } = await params;
    await connectDB();

    await Notification.updateOne(
      { _id: id },
      { $addToSet: { readBy: user!._id } }
    );

    return successResponse({ message: "تم تعليم الإشعار كمقروء" });
  } catch (err) {
    console.error("Finance notification read:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
