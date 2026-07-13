import { createHash } from "crypto";
import { connectDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import { errorResponse, successResponse } from "@/lib/api-response";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token || "");
    const password = String(body.password || "");

    if (!token) return errorResponse("رابط إعادة التعيين غير صالح");
    if (!password || password.length < 6) {
      return errorResponse("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    }

    await connectDB();
    const reset = await PasswordResetToken.findOne({
      tokenHash: hashToken(token),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
    if (!reset) return errorResponse("رابط إعادة التعيين غير صالح أو منتهي الصلاحية", 400);

    const user = await User.findByIdAndUpdate(reset.userId, {
      password: await hashPassword(password),
    });
    if (!user) return errorResponse("المستخدم غير موجود", 404);

    reset.usedAt = new Date();
    await reset.save();

    return successResponse({ message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
