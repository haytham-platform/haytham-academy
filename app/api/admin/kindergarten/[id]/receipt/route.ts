import KindergartenRegistration from "@/models/Kindergarten";
import { requireKindergartenView } from "@/lib/auth-helpers";
import { errorResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { minorToAmount } from "@/lib/student-finance";
import { receiptHtml, receiptPdf, type ReceiptDocument } from "@/lib/receipt-documents";

function paymentTypeLabel(type: string) {
  return { registration_fee: "رسوم الملف", weekly_fee: "اشتراك أسبوعي", monthly_fee: "اشتراك شهري" }[type] || type;
}

function paymentStatusLabel(status: string) {
  return { paid: "مدفوع", partially_paid: "مدفوع جزئيًا", unpaid: "غير مدفوع", overdue: "متأخر" }[status] || status;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requireKindergartenView();
    if (error) return error;
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "html";
    const layout = searchParams.get("layout") === "thermal" ? "thermal" : "a4";
    const paymentId = searchParams.get("paymentId");
    await connectDB();
    const registration = await KindergartenRegistration.findById(id).populate("teacherId", "name").lean();
    if (!registration) return errorResponse("تسجيل الروضة غير موجود", 404);
    const payment = paymentId
      ? registration.payments.find((item) => item._id?.toString() === paymentId)
      : registration.payments[registration.payments.length - 1];
    const receiptNumber = payment?.receiptNumber || `KG-${registration._id.toString().slice(-8).toUpperCase()}`;
    const teacher = registration.teacherId as unknown as { name?: string };
    const requiredAmount = payment?.paymentType === "registration_fee" ? registration.registrationFeeMinor : registration.subscriptionPriceMinor;
    const remainingAmount = payment?.paymentType === "registration_fee" ? registration.registrationRemainingMinor : registration.subscriptionRemainingMinor;
    const status = payment?.paymentType === "registration_fee" ? registration.registrationPaymentStatus : registration.subscriptionPaymentStatus;
    const doc: ReceiptDocument = {
      title: "وصل الروضة",
      receiptNumber,
      layout,
      fields: [
        { label: "الطفل", value: registration.childName },
        { label: "المربية", value: teacher?.name || "" },
        { label: "هاتف الولي", value: registration.guardianPhone },
        { label: "نوع الدفع", value: paymentTypeLabel(payment?.paymentType || (registration.subscriptionType === "weekly" ? "weekly_fee" : "monthly_fee")) },
        { label: "فترة الاشتراك", value: payment?.billingPeriod || registration.currentPeriod || "-" },
        { label: "المبلغ المطلوب", value: minorToAmount(requiredAmount) },
        { label: "المدفوع", value: minorToAmount(payment?.amountMinor || 0) },
        { label: "المتبقي", value: minorToAmount(remainingAmount) },
        { label: "حالة الدفع", value: paymentStatusLabel(status) },
        { label: "طريقة الدفع", value: payment?.paymentMethod || "-" },
        { label: "الصندوق", value: "الإدارة" },
        { label: "تاريخ الدفع", value: payment?.paymentDate ? new Date(payment.paymentDate).toLocaleDateString("ar-DZ") : "-" },
      ],
    };
    if (format === "pdf") {
      const pdf = await receiptPdf(doc);
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="kindergarten-receipt-${receiptNumber}.pdf"`,
        },
      });
    }
    return new Response(await receiptHtml(doc), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    console.error("Kindergarten receipt:", err);
    return errorResponse("تعذر إنشاء الوصل", 500);
  }
}
