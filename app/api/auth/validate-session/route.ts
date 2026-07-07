import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { validateSession } from "@/lib/session";
import { errorResponse, successResponse } from "@/lib/api-response";
import { JWT_COOKIE_NAME } from "@/lib/constants";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(JWT_COOKIE_NAME)?.value;

    if (!token) {
      return errorResponse("غير مصرح", 401);
    }

    const payload = verifyToken(token);
    if (!payload) {
      return errorResponse("غير مصرح", 401);
    }

    const validated = await validateSession(payload.sessionId, payload.userId);
    if (!validated) {
      return errorResponse("غير مصرح", 401);
    }

    return successResponse({
      userId: validated.user._id.toString(),
      role: validated.role,
    });
  } catch (error) {
    console.error("Validate session error:", error);
    return errorResponse("غير مصرح", 401);
  }
}
