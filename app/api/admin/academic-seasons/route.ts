import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { createAcademicSeason, listAcademicSeasons } from "@/lib/academic-seasons";

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("academic_seasons.view");
    if (error) return error;
    await connectDB();
    const { searchParams } = new URL(request.url);
    return successResponse(await listAcademicSeasons(searchParams));
  } catch (err) {
    console.error("Academic seasons GET:", err);
    return errorResponse("تعذر تحميل المواسم الدراسية", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("academic_seasons.create");
    if (error) return error;
    await connectDB();
    const season = await createAcademicSeason(await request.json(), user!._id);
    return successResponse({ season }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر إنشاء الموسم الدراسي";
    return errorResponse(message, 400);
  }
}
