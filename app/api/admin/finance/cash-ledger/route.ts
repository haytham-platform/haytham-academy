import { requireFinance } from "@/lib/auth-helpers";
import { getCashLedger } from "@/lib/cashbox";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { error } = await requireFinance();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const entries = await getCashLedger({
      type: searchParams.get("type") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      limit: Number(searchParams.get("limit") || 100),
    });

    return successResponse({ entries });
  } catch (err) {
    console.error("Cash ledger GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
