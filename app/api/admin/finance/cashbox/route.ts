import { requireFinance } from "@/lib/auth-helpers";
import { getCashboxOverview } from "@/lib/cashbox";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const { error } = await requireFinance();
    if (error) return error;

    const cashbox = await getCashboxOverview();
    return successResponse({ cashbox });
  } catch (err) {
    console.error("Cashbox GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
