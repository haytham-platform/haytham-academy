import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentPerformance, ParentPortalError } from "@/lib/parent-portal";

export async function GET(req: Request) {
  try {
    return successResponse(await getParentPerformance(new URL(req.url).searchParams));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الأداء الدراسي", error instanceof ParentPortalError ? error.status : 500);
  }
}
