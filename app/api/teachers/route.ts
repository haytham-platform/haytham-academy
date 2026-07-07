import { connectDB } from "@/lib/db";
import Teacher from "@/models/Teacher";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    await connectDB();

    const teachers = await Teacher.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = teachers.map((teacher) => ({
      _id: teacher._id.toString(),
      name: teacher.name,
      subject: teacher.subject,
      phone: teacher.phone,
      teachingLevel: teacher.teachingLevel,
    }));

    return successResponse({ teachers: formatted });
  } catch (error) {
    console.error("Teachers GET error:", error);
    return errorResponse("حدث خطأ أثناء جلب الأساتذة", 500);
  }
}
