import { requireKindergartenManage } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { changeKindergartenSubscription } from "@/lib/kindergarten";
import { arabicError } from "@/lib/arabic-errors";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireKindergartenManage();
    if (error) return error;
    const { id } = await params;
    const registration = await changeKindergartenSubscription(id, await request.json(), user!._id);
    return successResponse({ registration });
  } catch (err) {
    console.error("Kindergarten subscription POST:", err);
    return errorResponse(arabicError(err), 400);
  }
}
