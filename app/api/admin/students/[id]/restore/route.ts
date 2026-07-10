import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatStudent } from "@/lib/academic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("students.manage");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const student = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      { deletedAt: null, isActive: true, status: "active" },
      { new: true }
    ).select("-password");

    if (!student) return errorResponse("الطالب غير موجود", 404);

    return successResponse({
      message: "تم استرجاع الطالب بنجاح",
      student: formatStudent(student),
    });
  } catch (err) {
    console.error("Admin student restore:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
