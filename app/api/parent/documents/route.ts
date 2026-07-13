import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentDocuments, ParentPortalError } from "@/lib/parent-portal";

export async function GET(req: Request) {
  try {
    return successResponse(await getParentDocuments(new URL(req.url).searchParams));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الوثائق", error instanceof ParentPortalError ? error.status : 500);
  }
}
