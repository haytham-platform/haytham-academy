import { connectDB } from "@/lib/db";
import Course from "@/models/Course";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatCourse } from "@/lib/academic";
import { countOccupyingEnrollments } from "@/lib/enrollment-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("courses.manage");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const course = await Course.findOne({ _id: id, deletedAt: null })
      .populate("teacher", "name subject")
      .lean();

    if (!course) return errorResponse("الدورة غير موجودة", 404);

    return successResponse({ course: formatCourse(course) });
  } catch (err) {
    console.error("Admin course GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("courses.manage");
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    await connectDB();

    const existing = await Course.findOne({ _id: id, deletedAt: null });
    if (!existing) return errorResponse("الدورة غير موجودة", 404);

    const updates: Record<string, unknown> = {};
    if (body.title) updates.title = body.title.trim();
    if (body.description) updates.description = body.description.trim();
    if (body.teacher) updates.teacher = body.teacher;
    if (body.department !== undefined) updates.department = body.department?.trim() || "";
    if (body.price !== undefined) updates.price = Number(body.price);
    if (body.image !== undefined) updates.image = body.image;
    if (body.level) updates.level = body.level.trim();
    if (body.duration) updates.duration = body.duration.trim();
    if (body.startDate) updates.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) {
      updates.endDate = body.endDate ? new Date(body.endDate) : null;
    }
    if (body.studyDays !== undefined) updates.studyDays = body.studyDays?.trim() || "";
    if (body.startTime !== undefined) updates.startTime = body.startTime?.trim() || "";
    if (body.endTime !== undefined) updates.endTime = body.endTime?.trim() || "";
    if (body.room !== undefined) updates.room = body.room?.trim() || "";
    if (body.color !== undefined) updates.color = body.color?.trim() || "#6366f1";
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    if (body.seats !== undefined) {
      const newSeats = Number(body.seats);
      if (newSeats < 1) return errorResponse("عدد المقاعد غير صالح");
      const occupied = await countOccupyingEnrollments(id);
      if (newSeats < occupied) {
        return errorResponse("عدد المقاعد أقل من التسجيلات الحالية");
      }
      updates.seats = newSeats;
      updates.remainingSeats = newSeats - occupied;
    }

    const course = await Course.findByIdAndUpdate(id, updates, { new: true }).populate(
      "teacher",
      "name subject"
    );

    return successResponse({ course: formatCourse(course!) });
  } catch (err) {
    console.error("Admin course PUT:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("courses.manage");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const course = await Course.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { deletedAt: new Date(), isActive: false },
      { new: true }
    ).populate("teacher", "name subject");

    if (!course) return errorResponse("الدورة غير موجودة", 404);

    return successResponse({
      message: "تم حذف الدورة (حذف منطقي)",
      course: formatCourse(course),
    });
  } catch (err) {
    console.error("Admin course DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
