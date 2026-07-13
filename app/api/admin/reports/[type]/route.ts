import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import type { Permission } from "@/lib/permissions";
import {
  buildReport,
  reportCsvResponse,
  reportDefinition,
  reportExcelResponse,
  reportPdfResponse,
  reportPrintResponse,
} from "@/lib/reports-analytics";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const definition = reportDefinition(type);
    if (!definition) return errorResponse("نوع التقرير غير صالح", 404);

    const { searchParams } = new URL(request.url);
    const exportFormat = searchParams.get("export");
    const base = await requirePermission("reports.view");
    if (base.error) return base.error;

    const scoped = await requirePermission(definition.permission as Permission);
    if (scoped.error) return scoped.error;

    if (["csv", "excel", "pdf"].includes(exportFormat || "")) {
      const allowed = await requirePermission("reports.export");
      if (allowed.error) return allowed.error;
    }

    if (exportFormat === "print") {
      const allowed = await requirePermission("reports.print");
      if (allowed.error) return allowed.error;
    }

    await connectDB();
    const report = await buildReport(type, searchParams);
    if (exportFormat === "csv") return reportCsvResponse(report);
    if (exportFormat === "excel") return reportExcelResponse(report);
    if (exportFormat === "pdf") return reportPdfResponse(report);
    if (exportFormat === "print") return reportPrintResponse(report, base.user?.name);

    return successResponse({ report, [type]: report.rows, pagination: report.pagination });
  } catch (err) {
    console.error("Admin reports GET:", err);
    return errorResponse("حدث خطأ أثناء إنشاء التقرير", 500);
  }
}
