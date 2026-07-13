import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentAttendance, ParentPortalError } from "@/lib/parent-portal";

export async function GET(req: Request) {
  try {
    return successResponse(await getParentAttendance(new URL(req.url).searchParams));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الحضور", error instanceof ParentPortalError ? error.status : 500);
  }
}
