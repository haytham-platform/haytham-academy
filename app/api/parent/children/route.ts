import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentChildren, ParentPortalError } from "@/lib/parent-portal";

export async function GET() {
  try {
    return successResponse(await getParentChildren());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الأبناء", error instanceof ParentPortalError ? error.status : 500);
  }
}
