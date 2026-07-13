import { requirePermission } from "@/lib/auth-helpers";
import { successResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { connectDB } from "@/lib/db";
import { createRolloverPreview } from "@/lib/academic-seasons";

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("academic_seasons.rollover_preview");
    if (error) return error;
    const body = await request.json();
    await connectDB();
    const scope = body.scope ?? {
      academicLevel: body.academicLevel,
      className: body.className,
      groupName: body.groupName,
      enrollmentType: body.enrollmentType,
      studentIds: body.studentIds,
    };
    const job = await createRolloverPreview({ ...body, scope }, user!._id);
    return successResponse({ job, message: "تم إنشاء معاينة ترحيل آمنة. نفذ المهمة من مركز المواسم الدراسية." }, 201);
  } catch (error) {
    return handleRouteError("Student rollover POST", error);
  }
}
