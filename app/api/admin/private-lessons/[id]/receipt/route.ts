import { PrivateLesson } from "@/models/PrivateLesson";
import { StudentCharge, StudentPayment } from "@/models/StudentFinance";
import { requirePrivateLessonsView } from "@/lib/auth-helpers";
import { errorResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { minorToAmount } from "@/lib/student-finance";
import { receiptHtml, receiptPdf, type ReceiptDocument } from "@/lib/receipt-documents";

function label(status: string) {
  return { paid: "مدفوع", partially_paid: "مدفوع جزئيًا", unpaid: "غير مدفوع", cancelled: "ملغاة" }[status] || status;
}

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error } = await requirePrivateLessonsView();
    if (error) return error;
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "html";
    const layout = searchParams.get("layout") === "thermal" ? "thermal" : "a4";
    await connectDB();
    const lesson = await PrivateLesson.findById(id).populate("teacherId", "name").lean();
    if (!lesson) return errorResponse("الحصة الخاصة غير موجودة", 404);
    const chargeIds = chargeIdsFrom(lesson);
    const charges = chargeIds.length ? await StudentCharge.find({ _id: { $in: chargeIds } }).lean() : [];
    const payments = chargeIds.length ? await StudentPayment.find({ "allocations.chargeId": { $in: chargeIds } }).populate("receivedBy", "name").sort({ paymentDate: -1 }).lean() : [];
    const latestPayment = payments[0];
    const paidMinor = charges.reduce((sum, charge) => sum + charge.paidAmountMinor, 0);
    const remainingMinor = charges.reduce((sum, charge) => sum + charge.balanceMinor, 0);
    const receiptNumber = latestPayment?.receiptNumber || `PL-${lesson._id.toString().slice(-8).toUpperCase()}`;
    const teacher = lesson.teacherId as unknown as { name?: string };
    const doc: ReceiptDocument = {
      title: "وصل حصة خاصة",
      receiptNumber,
      layout,
      fields: [
        { label: "نوع الدفع", value: "حصة خاصة" },
        { label: "الطالب", value: lesson.students.map((student) => student.name).join("، ") },
        { label: "الأستاذ", value: teacher?.name || "" },
        { label: "هاتف الولي", value: lesson.students[0]?.phone || "" },
        { label: "تاريخ الحصة", value: new Date(lesson.lessonDate).toLocaleDateString("ar-DZ") },
        { label: "توقيت الحصة", value: `${lesson.startTime} - ${lesson.endTime}` },
        { label: "سعر الحصة", value: minorToAmount(lesson.pricing.finalAmountMinor) },
        { label: "المدفوع", value: minorToAmount(paidMinor) },
        { label: "المتبقي", value: minorToAmount(remainingMinor) },
        { label: "حالة الدفع", value: label(lesson.paymentStatus) },
        { label: "طريقة الدفع", value: latestPayment?.paymentMethod || "-" },
        { label: "الصندوق", value: (latestPayment?.receivedBy as { name?: string } | undefined)?.name || "الإدارة" },
        { label: "تاريخ الدفع", value: latestPayment?.paymentDate ? new Date(latestPayment.paymentDate).toLocaleDateString("ar-DZ") : "-" },
      ],
    };
    if (format === "pdf") {
      const pdf = await receiptPdf(doc);
      return new Response(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="private-lesson-receipt-${receiptNumber}.pdf"`,
        },
      });
    }
    return new Response(await receiptHtml(doc), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    console.error("Private lesson receipt:", err);
    return errorResponse("تعذر إنشاء الوصل", 500);
  }
}
