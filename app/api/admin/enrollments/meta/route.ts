import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Course from "@/models/Course";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const { error } = await requirePermission("enrollments.manage");
    if (error) return error;

    await connectDB();

    const [students, courses] = await Promise.all([
      User.find({ role: "student", deletedAt: null, isActive: true })
        .select("name phone")
        .sort({ name: 1 })
        .lean(),
      Course.find({ deletedAt: null, isActive: true })
        .select("title level remainingSeats seats")
        .sort({ title: 1 })
        .lean(),
    ]);

    return successResponse({
      students: students.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        phone: s.phone,
      })),
      courses: courses.map((c) => ({
        _id: c._id.toString(),
        title: c.title,
        level: c.level,
        remainingSeats: c.remainingSeats ?? c.seats,
        seats: c.seats,
      })),
    });
  } catch (err) {
    console.error("Enrollment meta GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
