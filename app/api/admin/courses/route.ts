import { connectDB } from "@/lib/db";
import Course from "@/models/Course";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatCourse, notDeletedFilter } from "@/lib/academic";
import {
  buildPaginationMeta,
  parsePagination,
  parseSort,
} from "@/lib/pagination";

function buildCourseFilter(searchParams: URLSearchParams) {
  const search = searchParams.get("search")?.trim();
  const level = searchParams.get("level")?.trim();
  const department = searchParams.get("department")?.trim();
  const teacherId = searchParams.get("teacherId");
  const isActive = searchParams.get("isActive");
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  const filter: Record<string, unknown> = notDeletedFilter(includeDeleted);

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }
  if (level) filter.level = { $regex: level, $options: "i" };
  if (department) filter.department = { $regex: department, $options: "i" };
  if (teacherId) filter.teacher = teacherId;
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;

  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("courses.manage");
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["title", "createdAt", "price", "startDate"], "createdAt");
    const filter = buildCourseFilter(searchParams);

    await connectDB();

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .populate("teacher", "name subject")
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Course.countDocuments(filter),
    ]);

    return successResponse({
      courses: courses.map((c) => formatCourse(c)),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Admin courses GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requirePermission("courses.manage");
    if (error) return error;

    const body = await request.json();
    const {
      title,
      description,
      teacher,
      price,
      level,
      duration,
      startDate,
      seats,
    } = body;

    if (!title?.trim()) return errorResponse("اسم الدورة مطلوب");
    if (!description?.trim()) return errorResponse("وصف الدورة مطلوب");
    if (!teacher) return errorResponse("الأستاذ مطلوب");
    if (price === undefined || price < 0) return errorResponse("السعر مطلوب");
    if (!level?.trim()) return errorResponse("المستوى مطلوب");
    if (!duration?.trim()) return errorResponse("مدة الدورة مطلوبة");
    if (!startDate) return errorResponse("تاريخ البداية مطلوب");
    if (!seats || seats < 1) return errorResponse("عدد المقاعد مطلوب");

    await connectDB();

    const seatCount = Number(seats);
    const course = await Course.create({
      title: title.trim(),
      description: description.trim(),
      teacher,
      department: body.department?.trim() || "",
      price: Number(price),
      image: body.image?.trim() || "",
      level: level.trim(),
      duration: duration.trim(),
      startDate: new Date(startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      studyDays: body.studyDays?.trim() || "",
      startTime: body.startTime?.trim() || "",
      endTime: body.endTime?.trim() || "",
      room: body.room?.trim() || "",
      color: body.color?.trim() || "#6366f1",
      seats: seatCount,
      remainingSeats: seatCount,
      isActive: body.isActive !== false,
    });

    const populated = await Course.findById(course._id)
      .populate("teacher", "name subject")
      .lean();

    return successResponse({ course: formatCourse(populated!) }, 201);
  } catch (err) {
    console.error("Admin courses POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
