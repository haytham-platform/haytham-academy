import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { processCommunication } from "@/lib/communications";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requirePermission("communications.send");
  if (error) return error;
  try {
    return successResponse(await processCommunication((await params).id, user!._id));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر الإرسال", 400);
  }
}
