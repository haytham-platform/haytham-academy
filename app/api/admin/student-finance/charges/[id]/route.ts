import mongoose from "mongoose";
import { StudentCharge } from "@/models/StudentFinance";
import { requireStudentFinanceManage } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { formatStudentCharge } from "@/lib/student-finance";
import { recordFinancialAudit } from "@/lib/audit";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireStudentFinanceManage();
    if (error) return error;
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse("معرف الرسم غير صالح", 400);
    const body = await request.json();
    await connectDB();
    const previous = await StudentCharge.findById(id).lean();
    if (!previous) return errorResponse("الرسم غير موجود", 404);
    const updates: Record<string, unknown> = {};
    if (body.description !== undefined) updates.description = String(body.description).trim();
    if (body.dueDate !== undefined) updates.dueDate = new Date(String(body.dueDate));
    if (body.notes !== undefined) updates.notes = String(body.notes).trim();
    if (body.status !== undefined && ["pending", "partially_paid", "paid", "overdue", "cancelled", "exempted", "refunded"].includes(body.status)) {
      updates.status = body.status;
    }
    updates.updatedBy = user!._id;
    const charge = await StudentCharge.findByIdAndUpdate(id, updates, { returnDocument: "after", runValidators: true }).lean();
    await recordFinancialAudit({
      userId: user!._id,
      action: "student_charge.update",
      recordType: "student_charge",
      recordId: id,
      metadata: { previousValues: formatStudentCharge(previous), newValues: formatStudentCharge(charge) },
    });
    return successResponse({ charge: formatStudentCharge(charge) });
  } catch (err) {
    console.error("Student charge PUT:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireStudentFinanceManage();
    if (error) return error;
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse("معرف الرسم غير صالح", 400);
    await connectDB();
    const charge = await StudentCharge.findByIdAndUpdate(
      id,
      {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: user!._id,
        cancellationReason: searchParams.get("reason") || "إلغاء رسم",
      },
      { returnDocument: "after" }
    ).lean();
    if (!charge) return errorResponse("الرسم غير موجود", 404);
    await recordFinancialAudit({
      userId: user!._id,
      action: "student_charge.cancel",
      recordType: "student_charge",
      recordId: id,
      metadata: { reason: searchParams.get("reason") || "" },
    });
    return successResponse({ charge: formatStudentCharge(charge) });
  } catch (err) {
    console.error("Student charge DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
