import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentFinance, ParentPortalError } from "@/lib/parent-portal";

export async function GET(req: Request) {
  try {
    return successResponse(await getParentFinance(new URL(req.url).searchParams));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل المالية", error instanceof ParentPortalError ? error.status : 500);
  }
}
