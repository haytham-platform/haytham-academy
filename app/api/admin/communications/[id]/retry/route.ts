import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { retryCommunication } from "@/lib/communications";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requirePermission("communications.retry");
  if (error) return error;
  try {
    return successResponse(await retryCommunication((await params).id, user!._id));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر إعادة المحاولة", 400);
  }
}
