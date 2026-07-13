import { requireStudentFinanceRefund } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { cancelStudentPayment } from "@/lib/student-finance";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireStudentFinanceRefund();
    if (error) return error;
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const payment = await cancelStudentPayment(id, searchParams.get("reason") || "إلغاء دفع", user!._id);
    return successResponse({ payment });
  } catch (err) {
    console.error("Student payment cancel:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 400);
  }
}
