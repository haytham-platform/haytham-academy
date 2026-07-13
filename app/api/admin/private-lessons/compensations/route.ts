import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsCompensation } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { formatCompensation } from "@/lib/private-lessons";
import { TeacherLessonCompensation } from "@/models/PrivateLesson";

export async function GET(request: Request) {
  try {
    const { error } = await requirePrivateLessonsCompensation();
    if (error) return error;
    const pagination = parsePagination(new URL(request.url).searchParams);
    await connectDB();
    const [rows, total] = await Promise.all([
      TeacherLessonCompensation.find().populate("teacherId", "name").sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      TeacherLessonCompensation.countDocuments(),
    ]);
    return successResponse({ compensations: rows.map(formatCompensation), pagination: buildPaginationMeta(total, pagination) });
  } catch (err) {
    console.error("Private lesson compensations GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
