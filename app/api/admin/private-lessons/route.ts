import mongoose from "mongoose";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePrivateLessonsManage, requirePrivateLessonsPricing, requirePrivateLessonsCompensation, requirePrivateLessonsView } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { buildPaginationMeta, parsePagination, parseSort } from "@/lib/pagination";
import { createPrivateLesson, formatPrivateLesson } from "@/lib/private-lessons";
import { arabicError } from "@/lib/arabic-errors";
import { PrivateLesson } from "@/models/PrivateLesson";

function buildFilter(searchParams: URLSearchParams) {
  const filter: Record<string, unknown> = { deletedAt: null };
  const search = searchParams.get("search")?.trim();
  const teacherId = searchParams.get("teacherId");
  const studentId = searchParams.get("studentId");
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("paymentStatus");
  const compensationStatus = searchParams.get("compensationStatus");
  const subject = searchParams.get("subject")?.trim();
  const academicLevel = searchParams.get("academicLevel")?.trim();
  const room = searchParams.get("room")?.trim();
  const format = searchParams.get("format");
  const season = searchParams.get("season")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) filter.teacherId = new mongoose.Types.ObjectId(teacherId);
  if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter["students.studentId"] = new mongoose.Types.ObjectId(studentId);
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (compensationStatus) filter["compensation.status"] = compensationStatus;
  if (subject) filter.subject = { $regex: subject, $options: "i" };
  if (academicLevel) filter.academicLevel = academicLevel;
  if (room) filter.room = { $regex: room, $options: "i" };
  if (format) filter.format = format;
  if (season) filter.academicSeason = season;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    filter.startAt = range;
  }
  if (search) {
    filter.$or = [
      { subject: { $regex: search, $options: "i" } },
      { academicLevel: { $regex: search, $options: "i" } },
      { "students.name": { $regex: search, $options: "i" } },
      { "students.phone": { $regex: search, $options: "i" } },
    ];
  }
  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePrivateLessonsView();
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["startAt", "createdAt", "durationMinutes"], "startAt");
    await connectDB();
    const filter = buildFilter(searchParams);
    const [lessons, total] = await Promise.all([
      PrivateLesson.find(filter)
        .populate("teacherId", "name subject")
        .populate("replacementTeacherId", "name")
        .populate("students.chargeId", "finalAmountMinor paidAmountMinor balanceMinor status")
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      PrivateLesson.countDocuments(filter),
    ]);
    return successResponse({ lessons: lessons.map(formatPrivateLesson), pagination: buildPaginationMeta(total, pagination) });
  } catch (err) {
    console.error("Private lessons GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePrivateLessonsManage();
    if (error) return error;
    const body = await request.json();
    const pricing = await requirePrivateLessonsPricing();
    const compensation = await requirePrivateLessonsCompensation();
    const lesson = await createPrivateLesson(body, user!._id, {
      canPriceOverride: !pricing.error,
      canCompensationOverride: !compensation.error,
      canAssignInactive: user!.role === "admin",
    });
    return successResponse({ lesson }, 201);
  } catch (err) {
    console.error("Private lessons POST:", err);
    return errorResponse(arabicError(err), 400);
  }
}
