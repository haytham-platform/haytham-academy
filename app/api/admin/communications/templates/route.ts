import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { listTemplates, upsertTemplate } from "@/lib/communications";

export async function GET(req: Request) {
  const { error } = await requirePermission("communications.view");
  if (error) return error;
  try {
    return successResponse(await listTemplates(new URL(req.url).searchParams));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل القوالب", 500);
  }
}

export async function POST(req: Request) {
  const { user, error } = await requirePermission("communications.manage_templates");
  if (error) return error;
  try {
    return successResponse(await upsertTemplate(await req.json(), user!._id), 201);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر حفظ القالب", 400);
  }
}
