import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requireFinancePayment } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getStudentEnrollmentOptions } from "@/lib/lesson-invoices";

export async function GET(request: Request) {
  try {
    const { error } = await requireFinancePayment();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) return errorResponse("معرّف الطالب مطلوب");

    await connectDB();

    const student = await User.findOne({
      _id: studentId,
      role: "student",
      deletedAt: null,
    });
    if (!student) return errorResponse("الطالب غير موجود", 404);

    const options = await getStudentEnrollmentOptions(studentId);

    if (!options.length) {
      return errorResponse("لا يوجد تسجيل مقبول للطالب في أي دورة", 404);
    }

    return successResponse({
      options,
      selected: options[0],
    });
  } catch (err) {
    console.error("Student invoice context GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
