import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { cancelCommunication } from "@/lib/communications";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requirePermission("communications.cancel");
  if (error) return error;
  try {
    return successResponse(await cancelCommunication((await params).id, user!._id));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر الإلغاء", 400);
  }
}
