import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentTransportation, ParentPortalError } from "@/lib/parent-portal";

export async function GET(req: Request) {
  try {
    return successResponse(await getParentTransportation(new URL(req.url).searchParams));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل النقل", error instanceof ParentPortalError ? error.status : 500);
  }
}
