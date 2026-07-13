import AcademicSeason from "@/models/AcademicSeason";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { updateAcademicSeason } from "@/lib/academic-seasons";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePermission("academic_seasons.view");
    if (error) return error;
    const { id } = await params;
    await connectDB();
    const season = await AcademicSeason.findById(id).lean();
    if (!season) return errorResponse("الموسم غير موجود", 404);
    return successResponse({ season });
  } catch (err) {
    console.error("Academic season GET:", err);
    return errorResponse("تعذر تحميل الموسم", 500);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePermission("academic_seasons.update");
    if (error) return error;
    const { id } = await params;
    await connectDB();
    const season = await updateAcademicSeason(id, await request.json(), user!._id);
    return successResponse({ season });
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر تحديث الموسم";
    return errorResponse(message, 400);
  }
}
