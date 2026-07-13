import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsCompensation, requirePrivateLessonsManage, requirePrivateLessonsPricing, requirePrivateLessonsView } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { createPrivateLessonSeries } from "@/lib/private-lessons";
import { PrivateLessonSeries } from "@/models/PrivateLesson";
import { arabicError } from "@/lib/arabic-errors";

export async function GET() {
  try {
    const { error } = await requirePrivateLessonsView();
    if (error) return error;
    await connectDB();
    const series = await PrivateLessonSeries.find().populate("teacherId", "name").sort({ createdAt: -1 }).limit(100).lean();
    return successResponse({ series });
  } catch (err) {
    console.error("Private lesson series GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePrivateLessonsManage();
    if (error) return error;
    const pricing = await requirePrivateLessonsPricing();
    const compensation = await requirePrivateLessonsCompensation();
    const result = await createPrivateLessonSeries(await request.json(), user!._id, {
      canPriceOverride: !pricing.error,
      canCompensationOverride: !compensation.error,
    });
    return successResponse(result, 201);
  } catch (err) {
    console.error("Private lesson series POST:", err);
    return errorResponse(arabicError(err), 400);
  }
}
