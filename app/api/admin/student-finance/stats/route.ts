import { requireStudentFinanceView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentFinanceStats } from "@/lib/student-finance";

export async function GET() {
  try {
    const { error } = await requireStudentFinanceView();
    if (error) return error;
    return successResponse({ stats: await getStudentFinanceStats() });
  } catch (err) {
    console.error("Student finance stats GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
