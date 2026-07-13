import KindergartenRegistration from "@/models/Kindergarten";
import mongoose from "mongoose";
import { requireKindergartenCorrection, requireKindergartenPayment, requireKindergartenView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { formatKindergartenRegistration, recordKindergartenPayment } from "@/lib/kindergarten";
import { recordFinancialAudit } from "@/lib/audit";
import { arabicError } from "@/lib/arabic-errors";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireKindergartenView();
    if (error) return error;
    const { id } = await params;
    await connectDB();
    const registration = await KindergartenRegistration.findById(id).lean();
    if (!registration) return errorResponse("تسجيل الروضة غير موجود", 404);
    return successResponse({ payments: registration.payments || [] });
  } catch (err) {
    console.error("Kindergarten payments GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireKindergartenPayment();
    if (error) return error;
    const { id } = await params;
    const registration = await recordKindergartenPayment(id, await request.json(), user!._id);
    return successResponse({ registration }, 201);
  } catch (err) {
    console.error("Kindergarten payment POST:", err);
    return errorResponse(arabicError(err), 400);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireKindergartenCorrection();
    if (error) return error;
    const { id } = await params;
    const paymentId = new URL(request.url).searchParams.get("paymentId");
    const reason = new URL(request.url).searchParams.get("reason") || "Correction";
    await connectDB();
    const registration = await KindergartenRegistration.findById(id);
    if (!registration) return errorResponse("تسجيل الروضة غير موجود", 404);
    const payment = registration.payments.find((item) => item._id?.toString() === paymentId);
    if (!payment) return errorResponse("الدفعة غير موجودة", 404);
    if (payment.cancelledAt) return errorResponse("تم إلغاء الدفعة مسبقًا", 409);
    payment.cancelledAt = new Date();
    payment.cancelledBy = new mongoose.Types.ObjectId(user!._id);
    payment.cancellationReason = reason;
    if (payment.paymentType === "registration_fee") registration.registrationPaidMinor = Math.max(0, registration.registrationPaidMinor - payment.amountMinor);
    else registration.subscriptionPaidMinor = Math.max(0, registration.subscriptionPaidMinor - payment.amountMinor);
    registration.registrationRemainingMinor = Math.max(0, registration.registrationFeeMinor - registration.registrationPaidMinor);
    registration.subscriptionRemainingMinor = Math.max(0, registration.subscriptionPriceMinor - registration.subscriptionPaidMinor);
    registration.totalOutstandingMinor = registration.registrationRemainingMinor + registration.subscriptionRemainingMinor;
    await registration.save();
    await recordFinancialAudit({ userId: user!._id, action: "kindergarten.payment.cancel", recordType: "kindergarten_registration", recordId: id, metadata: { paymentId, reason } });
    return successResponse({ registration: formatKindergartenRegistration(registration) });
  } catch (err) {
    console.error("Kindergarten payment DELETE:", err);
    return errorResponse(arabicError(err), 400);
  }
}
