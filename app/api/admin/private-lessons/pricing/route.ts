import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsPricing, requirePrivateLessonsView } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { createPrivateLessonPricing, formatPricing } from "@/lib/private-lessons";
import { PrivateLessonPricing } from "@/models/PrivateLesson";
import { arabicError } from "@/lib/arabic-errors";

export async function GET(request: Request) {
  try {
    const { error } = await requirePrivateLessonsView();
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const filter: Record<string, unknown> = {};
    if (searchParams.get("active") === "true") filter.isActive = true;
    if (searchParams.get("configurationType")) filter.configurationType = searchParams.get("configurationType");
    await connectDB();
    const pricing = await PrivateLessonPricing.find(filter).populate("teacherId", "name").sort({ effectiveDate: -1 }).lean();
    return successResponse({ pricing: pricing.map(formatPricing) });
  } catch (err) {
    console.error("Private lesson pricing GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePrivateLessonsPricing();
    if (error) return error;
    const pricing = await createPrivateLessonPricing(await request.json(), user!._id);
    return successResponse({ pricing }, 201);
  } catch (err) {
    console.error("Private lesson pricing POST:", err);
    return errorResponse(arabicError(err), 400);
  }
}
