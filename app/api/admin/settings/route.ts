import { requirePermission } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getAcademySettings, formatSettings } from "@/lib/settings";

export async function GET() {
  try {
    const { error } = await requirePermission("settings.manage");
    if (error) return error;

    const settings = await getAcademySettings();
    return successResponse({ settings: formatSettings(settings) });
  } catch (error) {
    console.error("Admin settings GET:", error);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const { error } = await requirePermission("settings.manage");
    if (error) return error;

    const body = await request.json();
    const settings = await getAcademySettings();

    if (!body.name?.trim()) return errorResponse("اسم الأكاديمية مطلوب");
    if (!body.phone?.trim()) return errorResponse("رقم الهاتف مطلوب");
    if (!body.address?.trim()) return errorResponse("العنوان مطلوب");
    if (!body.description?.trim()) return errorResponse("الوصف مطلوب");

    settings.name = body.name.trim();
    settings.nameEn = body.nameEn?.trim() || settings.nameEn;
    settings.description = body.description.trim();
    settings.phone = body.phone.trim();
    settings.address = body.address.trim();
    await settings.save();

    return successResponse({
      settings: formatSettings(settings),
      message: "تم حفظ الإعدادات بنجاح",
    });
  } catch (error) {
    console.error("Admin settings PUT:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
