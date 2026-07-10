import { requireFinanceReports } from "@/lib/auth-helpers";
import { reviewDailyCashClosure } from "@/lib/cashbox";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireFinanceReports();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const approvalStatus = body.approvalStatus === "rejected" ? "rejected" : "approved";

    const closure = await reviewDailyCashClosure({
      closureId: id,
      approvalStatus,
      reviewedBy: user!._id,
    });

    return successResponse({
      closure: {
        _id: closure._id.toString(),
        approvalStatus: closure.approvalStatus,
        reviewedAt: closure.reviewedAt,
      },
    });
  } catch (err) {
    console.error("Cash close review POST:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 500);
  }
}
