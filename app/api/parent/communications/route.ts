import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentCommunications, ParentPortalError } from "@/lib/parent-portal";

export async function GET(req: Request) {
  try {
    return successResponse(await getParentCommunications(new URL(req.url).searchParams));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل التواصل", error instanceof ParentPortalError ? error.status : 500);
  }
}
