import { connectDB } from "@/lib/db";
import User from "@/models/User";
import {
  comparePassword,
  signToken,
  getTokenCookieOptions,
  isEmail,
  toSafeUser,
} from "@/lib/auth";
import { createSession, getClientMeta } from "@/lib/session";
import { errorResponse, successResponse } from "@/lib/api-response";
import { JWT_COOKIE_NAME } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const emailOrPhone = body.emailOrPhone?.trim() || body.phone?.trim();
    const { password } = body;

    if (!emailOrPhone) {
      return errorResponse("البريد الإلكتروني أو رقم الهاتف مطلوب");
    }

    if (!password) {
      return errorResponse("كلمة المرور مطلوبة");
    }

    await connectDB();

    const query = isEmail(emailOrPhone)
      ? { email: emailOrPhone.toLowerCase() }
      : { phone: emailOrPhone };

    const user = await User.findOne(query).select("+password");
    if (!user) {
      return errorResponse("بيانات الدخول غير صحيحة", 401);
    }

    if (!user.isActive) {
      return errorResponse("حسابك معطل. تواصل مع الإدارة", 403);
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return errorResponse("بيانات الدخول غير صحيحة", 401);
    }

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

    const response = successResponse({
      user: toSafeUser(user),
      message: "تم تسجيل الدخول بنجاح",
    });

    response.cookies.set(JWT_COOKIE_NAME, token, getTokenCookieOptions(maxAgeSeconds));

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("حدث خطأ أثناء تسجيل الدخول", 500);
  }
}
