import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { Communication, getCommunication } from "@/lib/communications";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission("communications.view");
  if (error) return error;
  try {
    const sensitive = !(await requirePermission("communications.view_sensitive")).error;
    return successResponse(await getCommunication((await params).id, sensitive));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل التواصل", 404);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requirePermission("communications.update");
  if (error) return error;
  try {
    const body = await req.json();
    const id = (await params).id;
    const updated = await Communication.findOneAndUpdate(
      { _id: id, status: "draft" },
      { subject: body.subject, content: body.content, category: body.category, priority: body.priority, internalNotes: body.internalNotes, updatedBy: user!._id },
      { new: true }
    );
    if (!updated) return errorResponse("لا يمكن تعديل إلا المسودات", 400);
    return successResponse(await getCommunication(id, true));
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحديث التواصل", 400);
  }
}
