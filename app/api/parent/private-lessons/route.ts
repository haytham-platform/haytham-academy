import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentPrivateLessons, ParentPortalError } from "@/lib/parent-portal";

export async function GET(req: Request) {
  try {
    return successResponse(await getParentPrivateLessons(new URL(req.url).searchParams));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الحصص الخاصة", error instanceof ParentPortalError ? error.status : 500);
  }
}
