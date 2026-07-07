import { connectDB } from "@/lib/db";
import Enrollment from "@/models/Enrollment";
import Course from "@/models/Course";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { onEnrollmentCreated } from "@/lib/enrollment-service";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("يجب تسجيل الدخول أولاً", 401);
    }

    if (user.role !== "student") {
      return errorResponse("التسجيل في الدورات متاح للطلاب فقط", 403);
    }

    const body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      return errorResponse("معرف الدورة مطلوب");
    }

    await connectDB();

    const course = await Course.findOne({ _id: courseId, isActive: true, deletedAt: null });
    if (!course) {
      return errorResponse("الدورة غير موجودة أو غير متاحة", 404);
    }

    const existing = await Enrollment.findOne({
      student: user._id,
      course: courseId,
    });

    if (existing) {
      return errorResponse("أنت مسجل مسبقاً في هذه الدورة", 409);
    }

    try {
      await onEnrollmentCreated(courseId, "pending");
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "لا توجد مقاعد متاحة",
        400
      );
    }

    const enrollment = await Enrollment.create({
      student: user._id,
      course: courseId,
      status: "pending",
    });

    return successResponse(
      {
        message: "تم إرسال طلب التسجيل بنجاح. سيتم مراجعته من قبل الإدارة",
        enrollment: {
          _id: enrollment._id.toString(),
          status: enrollment.status,
        },
      },
      201
    );
  } catch (error) {
    console.error("Enrollment POST error:", error);
    return errorResponse("حدث خطأ أثناء التسجيل في الدورة", 500);
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "student") {
      return errorResponse("غير مصرح", 401);
    }

    await connectDB();

    const enrollments = await Enrollment.find({ student: user._id })
      .populate("student", "name phone")
      .populate({
        path: "course",
        populate: { path: "teacher", select: "name" },
      })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = enrollments.map((e) => ({
      _id: e._id.toString(),
      student: e.student,
      course: e.course,
      status: e.status,
      createdAt: e.createdAt,
    }));

    return successResponse({ enrollments: formatted });
  } catch (error) {
    console.error("Enrollment GET error:", error);
    return errorResponse("حدث خطأ", 500);
  }
}
