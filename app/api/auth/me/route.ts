import { getCurrentUser } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("غير مصرح", 401);
    }

    return successResponse({ user });
  } catch (error) {
    console.error("Me error:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
