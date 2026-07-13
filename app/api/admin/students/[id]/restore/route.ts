import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatStudent } from "@/lib/academic";
import { recordAudit } from "@/lib/audit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("students.restore");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const student = await User.findOneAndUpdate(
      { _id: id, role: "student" },
      { deletedAt: null, isActive: true, status: "active" },
      { returnDocument: "after" }
    ).select("-password");

    if (!student) return errorResponse("الطالب غير موجود", 404);

    await recordAudit({
      userId: user!._id,
      action: "student.restore",
      recordType: "student",
      recordId: id,
    });

    return successResponse({
      message: "تم استرجاع الطالب بنجاح",
      student: formatStudent(student),
    });
  } catch (err) {
    console.error("Admin student restore:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
