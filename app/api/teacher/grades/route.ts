import { errorResponse, successResponse } from "@/lib/api-response";
import { getTeacherGrades, saveTeacherGrade } from "@/lib/teacher-dashboard";

export async function GET(req: Request) {
  try {
    return successResponse(await getTeacherGrades(new URL(req.url).searchParams));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل النقاط", 403);
  }
}

export async function POST(req: Request) {
  try {
    return successResponse(await saveTeacherGrade(await req.json()), 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر حفظ النقاط", 400);
  }
}
