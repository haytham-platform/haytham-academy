import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentDashboardData, ParentPortalError } from "@/lib/parent-portal";

export async function GET() {
  try {
    return successResponse(await getParentDashboardData());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل لوحة ولي الأمر", error instanceof ParentPortalError ? error.status : 500);
  }
}
