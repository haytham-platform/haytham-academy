import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { previewRecipients } from "@/lib/communications";

export async function POST(req: Request) {
  const { error } = await requirePermission("communications.create");
  if (error) return error;
  try {
    const body = await req.json();
    return successResponse({ preview: await previewRecipients(body, Boolean(body.customRecipients)) });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر معاينة المستلمين", 400);
  }
}
