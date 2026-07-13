import { connectDB } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import User from "@/models/User";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getStudentProfile, StudentPortalError } from "@/lib/student-portal";

export async function GET() {
  try {
    return successResponse(await getStudentProfile());
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل الملف الشخصي", error instanceof StudentPortalError ? error.status : 500);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student") return errorResponse("غير مصرح", 401);

    const body = await request.json();
    const password = String(body.password || "");
    if (!password || password.length < 6) {
      return errorResponse("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    }

    await connectDB();
    const updated = await User.findByIdAndUpdate(user._id, {
      password: await hashPassword(password),
    });
    if (!updated) return errorResponse("المستخدم غير موجود", 404);

    return successResponse({ message: "تم تحديث كلمة المرور بنجاح" });
  } catch (error) {
    console.error("Student profile PUT:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
