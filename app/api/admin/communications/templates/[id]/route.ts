import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { CommunicationTemplate, upsertTemplate } from "@/lib/communications";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission("communications.view");
  if (error) return error;
  const template = await CommunicationTemplate.findById((await params).id).lean();
  if (!template) return errorResponse("القالب غير موجود", 404);
  return successResponse({ template });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requirePermission("communications.manage_templates");
  if (error) return error;
  try {
    return successResponse(await upsertTemplate(await req.json(), user!._id, (await params).id));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحديث القالب", 400);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission("communications.manage_templates");
  if (error) return error;
  await CommunicationTemplate.findByIdAndUpdate((await params).id, { isActive: false });
  return successResponse({ message: "تم تعطيل القالب" });
}
