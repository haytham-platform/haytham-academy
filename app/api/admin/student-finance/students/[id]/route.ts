import { requireStudentFinanceView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { buildStudentFinancialProfile } from "@/lib/student-finance";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireStudentFinanceView();
    if (error) return error;
    const { id } = await params;
    const profile = await buildStudentFinancialProfile(id);
    return successResponse({ profile });
  } catch (err) {
    console.error("Student finance profile GET:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 400);
  }
}
