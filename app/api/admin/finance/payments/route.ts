import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { requireFinance } from "@/lib/auth-helpers";
import {
  formatPayment,
  validateAmount,
  validateDate,
} from "@/lib/finance";
import { recordPaymentIn } from "@/lib/cashbox";
import { successResponse, errorResponse } from "@/lib/api-response";

function buildPaymentFilter(searchParams: URLSearchParams) {
  const filter: Record<string, unknown> = {};
  const courseId = searchParams.get("courseId");
  const paymentMethod = searchParams.get("paymentMethod");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (courseId) filter.courseId = courseId;
  if (paymentMethod) filter.paymentMethod = paymentMethod;

  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    filter.paymentDate = dateFilter;
  }

  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requireFinance();
    if (error) return error;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const filter = buildPaymentFilter(searchParams);

    if (search) {
      const students = await User.find({
        role: "student",
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      filter.studentId = { $in: students.map((s) => s._id) };
    }

    const payments = await Payment.find(filter)
      .populate("studentId", "name phone")
      .populate("courseId", "title")
      .sort({ paymentDate: -1 })
      .lean();

    return successResponse({
      payments: payments.map((p) => formatPayment(p)),
    });
  } catch (err) {
    console.error("Finance payments GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireFinance();
    if (error) return error;

    const body = await request.json();
    const amount = validateAmount(body.amount);
    const paymentDate = validateDate(body.paymentDate);

    if (!body.studentId) return errorResponse("الطالب مطلوب");
    if (!body.courseId) return errorResponse("الدورة مطلوبة");
    if (!amount) return errorResponse("المبلغ يجب أن يكون أكبر من صفر");
    if (!paymentDate) return errorResponse("تاريخ الدفع غير صالح");
    if (
      !["cash", "baridimob", "bank_transfer", "other"].includes(
        body.paymentMethod
      )
    ) {
      return errorResponse("طريقة الدفع غير صالحة");
    }

    await connectDB();

    const payment = await Payment.create({
      studentId: body.studentId,
      courseId: body.courseId,
      enrollmentId: body.enrollmentId || undefined,
      amount,
      paymentMethod: body.paymentMethod,
      paymentDate,
      type: body.type || "course_fee",
      note: body.note?.trim() || "",
      createdBy: user!._id,
    });

    await recordPaymentIn(
      payment._id.toString(),
      amount,
      `دفعة طالب — ${body.note?.trim() || "بدون ملاحظة"}`,
      user!._id
    );

    const populated = await Payment.findById(payment._id)
      .populate("studentId", "name phone")
      .populate("courseId", "title")
      .lean();

    return successResponse(
      { payment: formatPayment(populated) },
      201
    );
  } catch (err) {
    console.error("Finance payments POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
