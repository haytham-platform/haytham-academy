import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import LessonInvoice from "@/models/LessonInvoice";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import { requireFinancePayment } from "@/lib/auth-helpers";
import { validateDate } from "@/lib/finance";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import {
  computeTotalAmount,
  derivePaymentStatus,
  formatLessonInvoice,
  parseMonthRange,
  parseSessionCount,
  resolveStudentInvoiceContext,
  validateLessonInvoiceInput,
} from "@/lib/lesson-invoices";

function buildFilter(searchParams: URLSearchParams) {
  const filter: Record<string, unknown> = {};
  const teacherId = searchParams.get("teacherId");
  const studentId = searchParams.get("studentId");
  const paymentStatus = searchParams.get("paymentStatus");
  const month = searchParams.get("month");

  if (teacherId) {
    filter.teacherId = mongoose.Types.ObjectId.isValid(teacherId)
      ? new mongoose.Types.ObjectId(teacherId)
      : teacherId;
  }
  if (studentId) filter.studentId = studentId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const { start, end } = parseMonthRange(month);
  if (start && end) {
    filter.invoiceDate = { $gte: start, $lte: end };
  } else {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) {
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }
      filter.invoiceDate = dateFilter;
    }
  }

  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requireFinancePayment();
    if (error) return error;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const filter = buildFilter(searchParams);

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

    const invoices = await LessonInvoice.find(filter)
      .populate("studentId", "name phone")
      .populate("teacherId", "name subject adminShare")
      .populate("courseId", "title")
      .sort({ invoiceDate: -1 })
      .lean();

    return successResponse({
      invoices: invoices.map((row) => formatLessonInvoice(row)),
    });
  } catch (err) {
    console.error("Lesson invoices GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireFinancePayment();
    if (error) return error;

    const body = await request.json();
    const sessionCount = parseSessionCount(body.sessionCount);
    const pricePerSession = Number(body.pricePerSession);
    const paidAmount = Math.max(0, Number(body.paidAmount) || 0);
    const invoiceDate = validateDate(body.invoiceDate);

    const validationError = validateLessonInvoiceInput({
      studentId: body.studentId,
      sessionCount,
      pricePerSession,
      paidAmount,
    });
    if (validationError) return errorResponse(validationError);
    if (!sessionCount) return errorResponse("عدد الحصص غير صالح");
    if (!invoiceDate) return errorResponse("تاريخ الفاتورة غير صالح");

    await connectDB();

    const student = await User.findOne({
      _id: body.studentId,
      role: "student",
      deletedAt: null,
    });
    if (!student) return errorResponse("الطالب غير موجود", 404);

    const resolved = await resolveStudentInvoiceContext(
      body.studentId,
      body.enrollmentId
    );
    if ("error" in resolved && resolved.error) {
      return errorResponse(resolved.error, 404);
    }
    const ctx = resolved.context!;
    if (!ctx.teacherId || !ctx.courseId) {
      return errorResponse("تعذّر تحديد الأستاذ أو الدورة من تسجيل الطالب", 404);
    }
    if (!mongoose.Types.ObjectId.isValid(ctx.teacherId)) {
      return errorResponse("معرّف الأستاذ المرتبط بالدورة غير صالح", 404);
    }
    const linkedTeacher = await Teacher.findById(ctx.teacherId).lean();
    if (!linkedTeacher) {
      return errorResponse("الأستاذ المرتبط بتسجيل الطالب غير موجود", 404);
    }

    const totalAmount = computeTotalAmount(sessionCount, pricePerSession);
    const paymentStatus = derivePaymentStatus(paidAmount, totalAmount);

    const invoice = await LessonInvoice.create({
      studentId: new mongoose.Types.ObjectId(body.studentId),
      enrollmentId: new mongoose.Types.ObjectId(ctx.enrollmentId),
      courseId: new mongoose.Types.ObjectId(ctx.courseId),
      teacherId: new mongoose.Types.ObjectId(ctx.teacherId),
      subject: ctx.subject,
      sessionCount,
      pricePerSession,
      totalAmount,
      paidAmount,
      paymentStatus,
      invoiceDate,
      note: body.note?.trim() || "",
      createdBy: user!._id,
    });

    const populated = await LessonInvoice.findById(invoice._id)
      .populate("studentId", "name phone")
      .populate("teacherId", "name subject adminShare")
      .populate("courseId", "title")
      .lean();

    return successResponse({ invoice: formatLessonInvoice(populated!) }, 201);
  } catch (err) {
    return handleRouteError("Lesson invoices POST", err);
  }
}
