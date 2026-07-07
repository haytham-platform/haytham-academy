import { connectDB } from "@/lib/db";
import User from "@/models/User";
import {
  hashPassword,
  signToken,
  getTokenCookieOptions,
  toSafeUser,
} from "@/lib/auth";
import { createSession, getClientMeta } from "@/lib/session";
import { errorResponse, successResponse } from "@/lib/api-response";
import { JWT_COOKIE_NAME } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, password } = body;

    if (!name?.trim()) {
      return errorResponse("الاسم مطلوب");
    }

    if (!phone?.trim()) {
      return errorResponse("رقم الهاتف مطلوب");
    }

    if (!password || password.length < 6) {
      return errorResponse("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    }

    await connectDB();

    const existingUser = await User.findOne({ phone: phone.trim() });
    if (existingUser) {
      return errorResponse("رقم الهاتف مسجل مسبقاً", 409);
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role: "student",
    });

    const { userAgent, ipAddress } = getClientMeta(request);
    const { sessionId, maxAgeSeconds } = await createSession(
      user._id.toString(),
      userAgent,
      ipAddress
    );

    const token = signToken({
      userId: user._id.toString(),
      sessionId,
      role: user.role,
    });

    const response = successResponse(
      {
        user: toSafeUser(user),
        message: "تم إنشاء الحساب بنجاح",
      },
      201
    );

    response.cookies.set(JWT_COOKIE_NAME, token, getTokenCookieOptions(maxAgeSeconds));

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return errorResponse("حدث خطأ أثناء التسجيل", 500);
  }
}
