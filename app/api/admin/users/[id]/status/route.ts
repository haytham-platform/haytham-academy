import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireAdmin } from "@/lib/auth-helpers";
import { revokeAllUserSessions } from "@/lib/session";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: admin, error } = await requireAdmin();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    if (body.isActive === undefined || typeof body.isActive !== "boolean") {
      return errorResponse("isActive مطلوب (true/false)");
    }

    if (id === admin!._id) {
      return errorResponse("لا يمكنك تعطيل حسابك الخاص", 403);
    }

    await connectDB();

    const target = await User.findById(id).select("-password");
    if (!target) return errorResponse("المستخدم غير موجود", 404);

    const updated = await User.findByIdAndUpdate(
      id,
      { isActive: body.isActive },
      { new: true }
    ).select("-password");

    if (!updated) return errorResponse("المستخدم غير موجود", 404);

    if (!body.isActive) {
      await revokeAllUserSessions(id);
    }

    return successResponse({
      user: {
        _id: updated._id.toString(),
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
        isActive: updated.isActive,
      },
      message: body.isActive ? "تم تفعيل المستخدم" : "تم تعطيل المستخدم",
    });
  } catch (err) {
    console.error("Admin user status PUT:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
