import RolloverJob from "@/models/RolloverJob";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { createRolloverPreview } from "@/lib/academic-seasons";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("academic_seasons.rollover");
    if (error) return error;
    await connectDB();
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams, 20);
    const filter: Record<string, unknown> = {};
    if (searchParams.get("status")) filter.status = searchParams.get("status");
    if (searchParams.get("sourceSeason")) filter.sourceSeason = searchParams.get("sourceSeason");
    if (searchParams.get("targetSeason")) filter.targetSeason = searchParams.get("targetSeason");
    const [jobs, total] = await Promise.all([
      RolloverJob.find(filter).populate("createdBy", "name").sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      RolloverJob.countDocuments(filter),
    ]);
    return successResponse({ jobs, pagination: buildPaginationMeta(total, pagination) });
  } catch (err) {
    console.error("Rollover jobs GET:", err);
    return errorResponse("تعذر تحميل مهام الترحيل", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("academic_seasons.rollover_preview");
    if (error) return error;
    await connectDB();
    const job = await createRolloverPreview(await request.json(), user!._id);
    return successResponse({ job }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر إنشاء معاينة الترحيل";
    return errorResponse(message, 400);
  }
}
