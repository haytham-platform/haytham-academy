import RolloverJob from "@/models/RolloverJob";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission("academic_seasons.rollover");
    if (error) return error;
    const { id } = await params;
    await connectDB();
    const job = await RolloverJob.findById(id).populate("createdBy", "name").lean();
    if (!job) return errorResponse("مهمة الترحيل غير موجودة", 404);
    return successResponse({ job });
  } catch (err) {
    console.error("Rollover job GET:", err);
    return errorResponse("تعذر تحميل مهمة الترحيل", 500);
  }
}
