import { createHash, randomBytes } from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import PasswordResetToken from "@/models/PasswordResetToken";
import { errorResponse, successResponse } from "@/lib/api-response";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = body.phone?.trim();
    if (!phone) return errorResponse("رقم الهاتف مطلوب");

    await connectDB();
    const user = await User.findOne({ phone, isActive: true });

    let resetUrl: string | undefined;
    if (user) {
      const token = randomBytes(32).toString("hex");
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      });
      if (process.env.NODE_ENV !== "production") {
        resetUrl = `/reset-password?token=${token}`;
      }
    }

    return successResponse({
      message: "إذا كان الرقم مسجلاً، سيتم إنشاء رابط إعادة التعيين.",
      ...(resetUrl ? { resetUrl } : {}),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
