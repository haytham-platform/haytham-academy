import KindergartenRegistration from "@/models/Kindergarten";
import { requireKindergartenManage, requireKindergartenView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { formatKindergartenRegistration } from "@/lib/kindergarten";
import { recordFinancialAudit } from "@/lib/audit";
import { arabicError } from "@/lib/arabic-errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireKindergartenView();
    if (error) return error;
    const { id } = await params;
    await connectDB();
    const registration = await KindergartenRegistration.findById(id).populate("teacherId", "name").lean();
    if (!registration) return errorResponse("تسجيل الروضة غير موجود", 404);
    return successResponse({ registration: formatKindergartenRegistration(registration) });
  } catch (err) {
    console.error("Kindergarten item GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireKindergartenManage();
    if (error) return error;
    const { id } = await params;
    const body = await request.json();
    await connectDB();
    const registration = await KindergartenRegistration.findByIdAndUpdate(
      id,
      {
        childName: body.childName,
        teacherId: body.teacherId,
        guardianName: body.guardianName,
        guardianPhone: body.guardianPhone,
        groupName: body.groupName,
        attendanceSchedule: body.attendanceSchedule,
        startTime: body.startTime,
        endTime: body.endTime,
        status: body.status,
        notes: body.notes,
        updatedBy: user!._id,
      },
      { returnDocument: "after", runValidators: true }
    ).populate("teacherId", "name");
    if (!registration) return errorResponse("تسجيل الروضة غير موجود", 404);
    await recordFinancialAudit({ userId: user!._id, action: "kindergarten.registration.update", recordType: "kindergarten_registration", recordId: id, metadata: { newValues: formatKindergartenRegistration(registration) } });
    return successResponse({ registration: formatKindergartenRegistration(registration) });
  } catch (err) {
    console.error("Kindergarten PUT:", err);
    return errorResponse(arabicError(err), 400);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireKindergartenManage();
    if (error) return error;
    const { id } = await params;
    await connectDB();
    const registration = await KindergartenRegistration.findByIdAndUpdate(id, { deletedAt: new Date(), updatedBy: user!._id }, { returnDocument: "after" });
    if (!registration) return errorResponse("تسجيل الروضة غير موجود", 404);
    await recordFinancialAudit({ userId: user!._id, action: "kindergarten.registration.archive", recordType: "kindergarten_registration", recordId: id });
    return successResponse({ registration: formatKindergartenRegistration(registration) });
  } catch (err) {
    console.error("Kindergarten DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
