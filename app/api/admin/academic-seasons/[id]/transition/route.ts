import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { transitionAcademicSeason } from "@/lib/academic-seasons";
import type { Permission } from "@/lib/permissions";

const permissionByTransition: Record<string, Permission> = {
  activate: "academic_seasons.activate",
  close: "academic_seasons.close",
  reopen: "academic_seasons.reopen",
  archive: "academic_seasons.archive",
  restore: "academic_seasons.restore",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const transition = String(body.transition || "");
    const permission = permissionByTransition[transition];
    if (!permission) return errorResponse("عملية غير صالحة", 400);
    const { user, error } = await requirePermission(permission);
    if (error) return error;
    const { id } = await params;
    await connectDB();
    const season = await transitionAcademicSeason(id, transition, body, user!._id);
    return successResponse({ season });
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر تنفيذ العملية";
    return errorResponse(message, 400);
  }
}
