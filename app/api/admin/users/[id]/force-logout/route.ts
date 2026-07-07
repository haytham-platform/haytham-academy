import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireAdmin } from "@/lib/auth-helpers";
import { revokeAllUserSessions } from "@/lib/session";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const target = await User.findById(id).select("-password");
    if (!target) return errorResponse("المستخدم غير موجود", 404);

    await revokeAllUserSessions(id);

    return successResponse({
      message: "تم إنهاء جميع جلسات المستخدم بنجاح",
    });
  } catch (err) {
    console.error("Admin force logout POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
