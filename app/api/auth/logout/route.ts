import { NextResponse } from "next/server";
import {
  verifyToken,
  getTokenFromCookies,
  clearAuthCookie,
} from "@/lib/auth";
import { revokeSession } from "@/lib/session";

export async function POST() {
  try {
    const token = await getTokenFromCookies();
    if (token) {
      const payload = verifyToken(token);
      if (payload?.sessionId) {
        await revokeSession(payload.sessionId);
      }
    }

    const response = NextResponse.json({ message: "تم تسجيل الخروج بنجاح" });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    const response = NextResponse.json(
      { error: "حدث خطأ أثناء تسجيل الخروج" },
      { status: 500 }
    );
    clearAuthCookie(response);
    return response;
  }
}
