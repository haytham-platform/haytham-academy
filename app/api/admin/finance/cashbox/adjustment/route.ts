import { requireFinanceManager } from "@/lib/auth-helpers";
import { recordManualAdjustment, getCashboxOverview } from "@/lib/cashbox";
import { validateAmount } from "@/lib/finance";
import { recordFinancialAudit } from "@/lib/audit";
import { successResponse, errorResponse } from "@/lib/api-response";
import type { LedgerDirection } from "@/models/CashLedger";

export async function POST(request: Request) {
  try {
    const { user, error } = await requireFinanceManager();
    if (error) return error;

    const body = await request.json();
    const amount = validateAmount(body.amount);
    const direction = body.direction as LedgerDirection;
    const reason = body.reason?.trim();

    if (!amount) return errorResponse("المبلغ يجب أن يكون أكبر من صفر");
    if (direction !== "in" && direction !== "out") {
      return errorResponse("الاتجاه يجب أن يكون in أو out");
    }
    if (!reason) return errorResponse("سبب التعديل مطلوب");

    const { entry } = await recordManualAdjustment(amount, direction, reason, user!._id);
    await recordFinancialAudit({
      userId: user!._id,
      action: "cashbox.adjustment",
      recordType: "cash_ledger",
      recordId: entry._id.toString(),
      metadata: { amount, direction, reason },
    });

    const cashbox = await getCashboxOverview();
    return successResponse({
      message: "تم تسجيل التعديل بنجاح",
      cashbox,
    });
  } catch (err) {
    console.error("Cashbox adjustment POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
