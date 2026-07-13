import { errorResponse, successResponse } from "@/lib/api-response";
import { getParentPdfReport, getParentPrintableReport, getParentReports, ParentPortalError } from "@/lib/parent-portal";

export async function GET(req: Request) {
  try {
    const searchParams = new URL(req.url).searchParams;
    if (searchParams.get("export") === "pdf") {
      return getParentPdfReport(searchParams);
    }
    if (searchParams.get("export") === "print") {
      return getParentPrintableReport(searchParams);
    }
    return successResponse(await getParentReports(searchParams));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل التقارير", error instanceof ParentPortalError ? error.status : 500);
  }
}
