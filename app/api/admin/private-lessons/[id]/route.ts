import mongoose from "mongoose";
import { errorResponse, successResponse } from "@/lib/api-response";
import { recordFinancialAudit } from "@/lib/audit";
import { requirePrivateLessonsCompensation, requirePrivateLessonsManage, requirePrivateLessonsPricing, requirePrivateLessonsView } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { formatPrivateLesson, updatePrivateLesson } from "@/lib/private-lessons";
import { arabicError } from "@/lib/arabic-errors";
import { PrivateLesson } from "@/models/PrivateLesson";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePrivateLessonsView();
    if (error) return error;
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse("معرّف الحصة غير صالح", 400);
    await connectDB();
    const lesson = await PrivateLesson.findById(id)
      .populate("teacherId", "name subject")
      .populate("replacementTeacherId", "name")
      .populate("students.chargeId", "finalAmountMinor paidAmountMinor balanceMinor status")
      .lean();
    if (!lesson) return errorResponse("الحصة الخاصة غير موجودة", 404);
    return successResponse({ lesson: formatPrivateLesson(lesson) });
  } catch (err) {
    console.error("Private lesson GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePrivateLessonsManage();
    if (error) return error;
    const { id } = await params;
    const pricing = await requirePrivateLessonsPricing();
    const compensation = await requirePrivateLessonsCompensation();
    const lesson = await updatePrivateLesson(id, await request.json(), user!._id, {
      canPriceOverride: !pricing.error,
      canCompensationOverride: !compensation.error,
    });
    return successResponse({ lesson });
  } catch (err) {
    console.error("Private lesson PUT:", err);
    return errorResponse(arabicError(err), 400);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePrivateLessonsManage();
    if (error) return error;
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return errorResponse("معرّف الحصة غير صالح", 400);
    await connectDB();
    const lesson = await PrivateLesson.findById(id);
    if (!lesson) return errorResponse("الحصة الخاصة غير موجودة", 404);
    lesson.status = "archived";
    lesson.deletedAt = new Date();
    lesson.updatedBy = new mongoose.Types.ObjectId(user!._id);
    await lesson.save();
    await recordFinancialAudit({ userId: user!._id, action: "private_lesson.archive", recordType: "private_lesson", recordId: id, metadata: {} });
    return successResponse({ lesson: formatPrivateLesson(lesson) });
  } catch (err) {
    console.error("Private lesson DELETE:", err);
    return errorResponse(arabicError(err), 400);
  }
}
