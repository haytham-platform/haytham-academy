import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherStudents } from "@/lib/teacher-dashboard";

export async function GET(req: Request) {
  try {
    return successResponse(await getTeacherStudents(new URL(req.url).searchParams));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل الطلاب", 403);
  }
}
