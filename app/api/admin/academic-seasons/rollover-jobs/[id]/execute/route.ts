import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { executeRolloverJob } from "@/lib/academic-seasons";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission("academic_seasons.rollover_execute");
    if (error) return error;
    const body = await request.json();
    if (body.overrideWarnings) {
      const override = await requirePermission("academic_seasons.rollover_override");
      if (override.error) return override.error;
    }
    const { id } = await params;
    await connectDB();
    const job = await executeRolloverJob(id, body, user!._id);
    return successResponse({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر تنفيذ الترحيل";
    return errorResponse(message, 400);
  }
}
