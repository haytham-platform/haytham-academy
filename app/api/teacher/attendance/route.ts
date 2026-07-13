import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherAttendance, saveTeacherAttendance } from "@/lib/teacher-dashboard";

export async function GET(req: Request) {
  try {
    return successResponse(await getTeacherAttendance(new URL(req.url).searchParams));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل الحضور", 403);
  }
}

export async function POST(req: Request) {
  try {
    return successResponse(await saveTeacherAttendance(await req.json()), 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تسجيل الحضور", 400);
  }
}
