import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsReports } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { formatCompensation, formatPrivateLesson } from "@/lib/private-lessons";
import { minorToAmount } from "@/lib/student-finance";
import { PrivateLesson, TeacherLessonCompensation } from "@/models/PrivateLesson";

function dateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return Object.keys(range).length ? range : null;
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePrivateLessonsReports();
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "daily_lessons";
    const pagination = parsePagination(searchParams, 25);
    const range = dateRange(searchParams);
    await connectDB();

    if (["daily_lessons", "weekly_lessons", "monthly_lessons", "completed_lessons", "cancelled_lessons"].includes(type)) {
      const filter: Record<string, unknown> = { deletedAt: null };
      if (range) filter.startAt = range;
      if (type === "completed_lessons") filter.status = "completed";
      if (type === "cancelled_lessons") filter.status = "cancelled";
      const [lessons, total] = await Promise.all([
        PrivateLesson.find(filter).populate("teacherId", "name").sort({ startAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
        PrivateLesson.countDocuments(filter),
      ]);
      return successResponse({ report: lessons.map(formatPrivateLesson), pagination: buildPaginationMeta(total, pagination) });
    }

    if (["lessons_by_teacher", "lessons_by_subject", "lessons_by_academic_level"].includes(type)) {
      const groupField = type === "lessons_by_teacher" ? "$teacherId" : type === "lessons_by_subject" ? "$subject" : "$academicLevel";
      const rows = await PrivateLesson.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: groupField, count: { $sum: 1 }, revenue: { $sum: "$pricing.finalAmountMinor" }, compensation: { $sum: "$compensation.amountMinor" } } },
        ...(type === "lessons_by_teacher" ? [{ $lookup: { from: "teachers", localField: "_id", foreignField: "_id", as: "teacher" } }, { $unwind: { path: "$teacher", preserveNullAndEmptyArrays: true } }] : []),
        { $sort: { count: -1 } },
      ]);
      return successResponse({
        report: rows.map((row) => ({
          key: row._id?.toString?.() ?? row._id ?? "",
          teacherName: row.teacher?.name ?? "",
          count: row.count,
          revenue: minorToAmount(row.revenue),
          compensation: minorToAmount(row.compensation),
        })),
      });
    }

    if (type === "student_attendance" || type === "teacher_attendance") {
      const field = type === "student_attendance" ? "$studentAttendanceStatus" : "$teacherAttendanceStatus";
      const rows = await PrivateLesson.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: field, count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
      return successResponse({ report: rows.map((row) => ({ status: row._id, count: row.count })) });
    }

    if (type === "private_lesson_revenue" || type === "outstanding_lesson_balances") {
      const rows = await PrivateLesson.aggregate([
        { $match: { deletedAt: null, status: { $ne: "cancelled" } } },
        { $group: { _id: "$paymentStatus", total: { $sum: "$pricing.finalAmountMinor" }, count: { $sum: 1 } } },
      ]);
      return successResponse({ report: rows.map((row) => ({ paymentStatus: row._id, total: minorToAmount(row.total), count: row.count })) });
    }

    if (type === "teacher_compensation" || type === "teacher_payout_eligibility") {
      const [rows, total] = await Promise.all([
        TeacherLessonCompensation.find(type === "teacher_payout_eligibility" ? { approvalStatus: "approved", paymentStatus: "approved" } : {})
          .populate("teacherId", "name")
          .sort({ createdAt: -1 })
          .skip(pagination.skip)
          .limit(pagination.limit)
          .lean(),
        TeacherLessonCompensation.countDocuments(type === "teacher_payout_eligibility" ? { approvalStatus: "approved", paymentStatus: "approved" } : {}),
      ]);
      return successResponse({ report: rows.map(formatCompensation), pagination: buildPaginationMeta(total, pagination) });
    }

    if (type === "manual_pricing_overrides") {
      const lessons = await PrivateLesson.find({ "pricing.manualOverride": true }).populate("teacherId", "name").sort({ createdAt: -1 }).lean();
      return successResponse({ report: lessons.map(formatPrivateLesson) });
    }

    if (type === "cancellation_history" || type === "postponement_history") {
      const filter: Record<string, unknown> = type === "cancellation_history" ? { status: "cancelled" } : { postponedFrom: { $exists: true } };
      const lessons = await PrivateLesson.find({ ...filter, deletedAt: null }).populate("teacherId", "name").sort({ updatedAt: -1 }).lean();
      return successResponse({ report: lessons.map(formatPrivateLesson) });
    }

    return errorResponse("نوع التقرير غير صالح", 404);
  } catch (err) {
    console.error("Private lesson reports GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
