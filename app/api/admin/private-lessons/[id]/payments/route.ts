import { PrivateLesson } from "@/models/PrivateLesson";
import { StudentCharge } from "@/models/StudentFinance";
import { requirePrivateLessonsFinance, requirePrivateLessonsView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { createStudentPayment, minorToAmount } from "@/lib/student-finance";
import { syncPrivateLessonPaymentStatus } from "@/lib/private-lessons";
import { arabicError } from "@/lib/arabic-errors";

function chargeIdsFrom(lesson: { students: { chargeId?: unknown }[] }) {
  return lesson.students
    .map((student) => student.chargeId)
    .map((id) => {
      if (!id) return null;
      if (id instanceof Object && "_id" in id) return String((id as { _id: unknown })._id);
      return String(id);
    })
    .filter((id): id is string => Boolean(id) && id !== "undefined" && id !== "null");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePrivateLessonsView();
    if (error) return error;
    const { id } = await params;
    await connectDB();
    const lesson = await PrivateLesson.findById(id).lean();
    if (!lesson) return errorResponse("الحصة الخاصة غير موجودة", 404);
    const chargeIds = chargeIdsFrom(lesson);
    const charges = chargeIds.length ? await StudentCharge.find({ _id: { $in: chargeIds } }).lean() : [];
    return successResponse({
      charges: charges.map((charge) => ({
        _id: charge._id.toString(),
        studentId: charge.studentId.toString(),
        finalAmount: minorToAmount(charge.finalAmountMinor),
        paidAmount: minorToAmount(charge.paidAmountMinor),
        remainingAmount: minorToAmount(charge.balanceMinor),
        status: charge.status,
      })),
    });
  } catch (err) {
    console.error("Private lesson payments GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requirePrivateLessonsFinance();
    if (error) return error;
    const { id } = await params;
    const body = await request.json();
    await connectDB();
    const lesson = await PrivateLesson.findById(id);
    if (!lesson) return errorResponse("الحصة الخاصة غير موجودة", 404);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse("مبلغ الدفع غير صالح", 400);
    const chargeIds = chargeIdsFrom(lesson);
    const charges = await StudentCharge.find({ _id: { $in: chargeIds }, balanceMinor: { $gt: 0 } }).sort({ createdAt: 1 });
    const remainingTotal = minorToAmount(charges.reduce((sum, charge) => sum + charge.balanceMinor, 0));
    if (amount > remainingTotal) return errorResponse("لا يمكن أن يتجاوز الدفع الرصيد المتبقي للحصة", 400);
    let remaining = amount;
    const payments = [];
    for (const charge of charges) {
      if (remaining <= 0) break;
      const share = Math.min(remaining, minorToAmount(charge.balanceMinor));
      payments.push(await createStudentPayment({
        studentId: charge.studentId.toString(),
        amount: share,
        paymentDate: body.paymentDate || new Date().toISOString(),
        paymentMethod: body.paymentMethod || "cash",
        allocations: [{ chargeId: charge._id.toString(), amount: share }],
        academicSeason: lesson.academicSeason,
        idempotencyKey: body.idempotencyKey ? `${body.idempotencyKey}-${charge._id.toString()}` : undefined,
        notes: body.notes || `دفع حصة خاصة - ${lesson.subject}`,
      }, user!._id));
      remaining = Math.round((remaining - share) * 100) / 100;
    }
    const synced = await syncPrivateLessonPaymentStatus(id);
    return successResponse({ payments, lesson: synced }, 201);
  } catch (err) {
    console.error("Private lesson payment POST:", err);
    return errorResponse(arabicError(err), 400);
  }
}
