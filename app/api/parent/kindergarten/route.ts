import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentKindergarten, ParentPortalError } from "@/lib/parent-portal";

export async function GET(req: Request) {
  try {
    return successResponse(await getParentKindergarten(new URL(req.url).searchParams));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الروضة", error instanceof ParentPortalError ? error.status : 500);
  }
}
