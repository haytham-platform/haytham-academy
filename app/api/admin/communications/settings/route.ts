import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { providerStatuses } from "@/lib/communications";

export async function GET() {
  const { error } = await requirePermission("communications.manage_settings");
  if (error) return error;
  try {
    return successResponse({ providers: await providerStatuses() });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "تعذر تحميل إعدادات المزودين", 500);
  }
}
