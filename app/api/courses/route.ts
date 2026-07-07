import { connectDB } from "@/lib/db";
import Course from "@/models/Course";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    await connectDB();

    const courses = await Course.find({ isActive: true, deletedAt: null })
      .populate("teacher", "name subject")
      .sort({ createdAt: -1 })
      .lean();

    const formatted = courses.map((course) => ({
      _id: course._id.toString(),
      title: course.title,
      description: course.description,
      teacher: course.teacher,
      price: course.price,
      image: course.image,
      level: course.level,
      duration: course.duration,
      startDate: course.startDate,
      seats: course.seats,
      remainingSeats: course.remainingSeats ?? course.seats,
      isActive: course.isActive,
    }));

    return successResponse({ courses: formatted });
  } catch (error) {
    console.error("Courses GET error:", error);
    return errorResponse("حدث خطأ أثناء جلب الدورات", 500);
  }
}
