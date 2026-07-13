import mongoose from "mongoose";
import { StudentFeeConfig } from "@/models/StudentFinance";
import { requireStudentFinanceManage } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { amountToMinor, formatStudentFeeConfig } from "@/lib/student-finance";
import { recordFinancialAudit } from "@/lib/audit";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireStudentFinanceManage();
    if (error) return error;
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse("معرف الرسم غير صالح", 400);
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedBy: user!._id };
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.type !== undefined) updates.type = body.type;
    if (body.amount !== undefined) {
      const amountMinor = amountToMinor(body.amount);
      if (!amountMinor || amountMinor <= 0) return errorResponse("مبلغ الرسم غير صالح");
      updates.amountMinor = amountMinor;
    }
    if (body.academicLevel !== undefined) updates.academicLevel = String(body.academicLevel).trim();
    if (body.season !== undefined) updates.season = String(body.season).trim();
    if (body.effectiveDate !== undefined) updates.effectiveDate = new Date(String(body.effectiveDate));
    if (body.expirationDate !== undefined) updates.expirationDate = body.expirationDate ? new Date(String(body.expirationDate)) : undefined;
    if (body.isActive !== undefined) updates.isActive = body.isActive === true;
    await connectDB();
    const previous = await StudentFeeConfig.findById(id).lean();
    const fee = await StudentFeeConfig.findByIdAndUpdate(id, updates, { returnDocument: "after", runValidators: true }).lean();
    if (!fee) return errorResponse("الرسم غير موجود", 404);
    await recordFinancialAudit({
      userId: user!._id,
      action: "student_fee_config.update",
      recordType: "student_fee_config",
      recordId: id,
      metadata: { previousValues: previous ? formatStudentFeeConfig(previous) : null, newValues: formatStudentFeeConfig(fee) },
    });
    return successResponse({ fee: formatStudentFeeConfig(fee) });
  } catch (err) {
    console.error("Student fee PUT:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireStudentFinanceManage();
    if (error) return error;
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse("معرف الرسم غير صالح", 400);
    await connectDB();
    const fee = await StudentFeeConfig.findByIdAndUpdate(id, { isActive: false, updatedBy: user!._id }, { returnDocument: "after" }).lean();
    if (!fee) return errorResponse("الرسم غير موجود", 404);
    await recordFinancialAudit({ userId: user!._id, action: "student_fee_config.archive", recordType: "student_fee_config", recordId: id });
    return successResponse({ fee: formatStudentFeeConfig(fee) });
  } catch (err) {
    console.error("Student fee DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
