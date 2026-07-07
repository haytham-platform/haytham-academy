import { requireFinance } from "@/lib/auth-helpers";
import { getFinanceSummary } from "@/lib/finance";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const { error } = await requireFinance();
    if (error) return error;

    const summary = await getFinanceSummary();
    return successResponse({ summary });
  } catch (err) {
    console.error("Finance summary GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
