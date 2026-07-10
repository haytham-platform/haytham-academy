import { requireFinanceReports } from "@/lib/auth-helpers";
import { computeReport } from "@/lib/finance";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { error } = await requireFinanceReports();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "monthly";

    const report = await computeReport({
      type,
      courseId: searchParams.get("courseId") || undefined,
      teacherId: searchParams.get("teacherId") || undefined,
      paymentMethod: searchParams.get("paymentMethod") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    });

    return successResponse({ report });
  } catch (err) {
    console.error("Finance reports GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
