import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { createOpeningBalance } from "@/lib/academic-seasons";

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("academic_seasons.rollover_execute");
    if (error) return error;
    await connectDB();
    const charge = await createOpeningBalance(await request.json(), user!._id);
    return successResponse({ charge }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر إنشاء الرصيد الافتتاحي";
    return errorResponse(message, 400);
  }
}
