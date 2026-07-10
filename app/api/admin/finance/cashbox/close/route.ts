import { requireFinanceCash } from "@/lib/auth-helpers";
import { closeDailyCash, getCashboxOverview } from "@/lib/cashbox";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const { user, error } = await requireFinanceCash();
    if (error) return error;

    const body = await request.json();
    const closure = await closeDailyCash({
      actualCash: Number(body.actualCash),
      note: body.note?.trim() || "",
      enteredBy: user!._id,
    });
    const cashbox = await getCashboxOverview();

    return successResponse({
      closure: {
        _id: closure._id.toString(),
        expectedCash: closure.expectedCash,
        actualCash: closure.actualCash,
        difference: closure.difference,
        status: closure.status,
        approvalStatus: closure.approvalStatus,
        note: closure.note ?? "",
        updatedAt: closure.updatedAt,
      },
      cashbox,
    });
  } catch (err) {
    console.error("Cash close POST:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 500);
  }
}
