import { connectDB } from "@/lib/db";
import Course from "@/models/Course";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const { error } = await requirePermission("students.view");
    if (error) return error;

    await connectDB();

    const courses = await Course.find({ deletedAt: null, isActive: true })
      .select("title level price remainingSeats seats")
      .sort({ title: 1 })
      .lean();

    return successResponse({
      courses: courses.map((course) => ({
        _id: course._id.toString(),
        title: course.title,
        level: course.level,
        price: course.price,
        remainingSeats: course.remainingSeats ?? course.seats,
      })),
    });
  } catch (err) {
    console.error("Admin students meta GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
