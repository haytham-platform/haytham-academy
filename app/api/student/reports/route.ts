import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentPdfReport, getStudentPrintableReport, getStudentReports, StudentPortalError } from "@/lib/student-portal";

export async function GET(req: Request) {
  try {
    const searchParams = new URL(req.url).searchParams;
    if (searchParams.get("export") === "pdf") return getStudentPdfReport();
    if (searchParams.get("export") === "print") return getStudentPrintableReport();
    return successResponse(await getStudentReports());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل التقارير", error instanceof StudentPortalError ? error.status : 500);
  }
}
