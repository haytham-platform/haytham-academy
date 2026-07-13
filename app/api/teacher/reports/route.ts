import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherReports } from "@/lib/teacher-dashboard";

export async function GET(req: Request) {
  try {
    const result = await getTeacherReports(new URL(req.url).searchParams);
    return successResponse(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل التقارير", 403);
  }
}
