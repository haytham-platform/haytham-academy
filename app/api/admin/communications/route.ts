import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { createCommunicationRecord, listCommunications } from "@/lib/communications";

export async function GET(req: Request) {
  const { error } = await requirePermission("communications.view");
  if (error) return error;
  try {
    return successResponse(await listCommunications(new URL(req.url).searchParams));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل مركز التواصل", 500);
  }
}

export async function POST(req: Request) {
  const { user, error } = await requirePermission("communications.create");
  if (error) return error;
  try {
    const body = await req.json();
    const mode = body.mode === "send" ? "send" : body.mode === "schedule" ? "schedule" : "draft";
    if (mode === "send") {
      const allowed = await requirePermission("communications.send");
      if (allowed.error) return allowed.error;
    }
    if (mode === "schedule") {
      const allowed = await requirePermission("communications.schedule");
      if (allowed.error) return allowed.error;
    }
    const result = await createCommunicationRecord(body, user!._id, { mode, canUseCustom: Boolean(body.customRecipients), overridePreferences: Boolean(body.overridePreferences), overrideReason: body.overrideReason });
    return successResponse(result, 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر إنشاء التواصل", 400);
  }
}
