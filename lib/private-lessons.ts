import mongoose from "mongoose";
import Course from "@/models/Course";
import Teacher from "@/models/Teacher";
import User from "@/models/User";
import {
  PrivateLesson,
  PrivateLessonAttendance,
  PrivateLessonNote,
  PrivateLessonPerformance,
  PrivateLessonPricing,
  PrivateLessonSeries,
  TeacherLessonCompensation,
  type IPrivateLessonPricing,
  type PrivateLessonCompensationMethod,
  type PrivateLessonFormat,
  type PrivateLessonPaymentStatus,
  type PrivateLessonPricingMethod,
  type PrivateLessonStatus,
  type StudentLessonAttendanceStatus,
  type TeacherLessonAttendanceStatus,
} from "@/models/PrivateLesson";
import { StudentCharge } from "@/models/StudentFinance";
import { recordFinancialAudit } from "@/lib/audit";
import { connectDB } from "@/lib/db";
import { amountToMinor, createStudentCharge, createStudentPayment, minorToAmount } from "@/lib/student-finance";

type Session = mongoose.ClientSession;

export const PRIVATE_LESSON_FORMATS: PrivateLessonFormat[] = ["individual", "small_group", "online", "in_person"];
export const PRIVATE_LESSON_STATUSES: PrivateLessonStatus[] = ["scheduled", "confirmed", "completed", "cancelled", "postponed", "no_show", "in_progress", "archived"];
export const BILLABLE_LESSON_STATUSES: PrivateLessonStatus[] = ["scheduled", "confirmed", "in_progress", "completed"];
const CONFLICT_STATUSES: PrivateLessonStatus[] = ["scheduled", "confirmed", "in_progress"];

function isStandaloneTransactionError(error: unknown) {
  return error instanceof Error && (
    error.message.includes("Transaction numbers are only allowed") ||
    error.message.includes("does not support retryable writes")
  );
}

async function runLessonMutation<T>(work: (session?: Session) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } catch (error) {
    if (isStandaloneTransactionError(error)) return work();
    throw error;
  } finally {
    await session.endSession();
  }
}

function objectId(value: unknown) {
  const stringValue = String(value || "");
  return mongoose.Types.ObjectId.isValid(stringValue) ? new mongoose.Types.ObjectId(stringValue) : null;
}

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function validDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTimeToMinutes(time: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function combineDateTime(date: Date, time: string) {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null) return null;
  const combined = new Date(date);
  combined.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return combined;
}

function dateOnly(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function calculateByMethod(config: Pick<IPrivateLessonPricing, "pricingMethod" | "amountMinor">, durationMinutes: number, studentCount: number) {
  if (config.pricingMethod === "hourly") return Math.round((config.amountMinor * durationMinutes) / 60);
  if (config.pricingMethod === "per_student_group") return config.amountMinor * studentCount;
  return config.amountMinor;
}

async function getActivePricing(params: {
  teacherId: mongoose.Types.ObjectId;
  academicLevel: string;
  subject: string;
  lessonDate: Date;
}) {
  const activeWindow = {
    isActive: true,
    effectiveDate: { $lte: params.lessonDate },
    $or: [{ expirationDate: { $exists: false } }, { expirationDate: null }, { expirationDate: { $gte: params.lessonDate } }],
  };

  const teacherRate = await PrivateLessonPricing.findOne({
    ...activeWindow,
    configurationType: "teacher_specific",
    teacherId: params.teacherId,
    $or: [{ subject: params.subject }, { subject: "" }, { subject: { $exists: false } }],
  }).sort({ subject: -1, effectiveDate: -1 }).lean();
  if (teacherRate) return teacherRate;

  const levelRate = await PrivateLessonPricing.findOne({
    ...activeWindow,
    configurationType: "academic_level_default",
    academicLevel: params.academicLevel,
    $or: [{ subject: params.subject }, { subject: "" }, { subject: { $exists: false } }],
  }).sort({ subject: -1, effectiveDate: -1 }).lean();
  if (levelRate) return levelRate;

  return PrivateLessonPricing.findOne({
    ...activeWindow,
    configurationType: "system_default",
  }).sort({ effectiveDate: -1 }).lean();
}

async function resolvePricing(body: Record<string, unknown>, base: {
  teacherId: mongoose.Types.ObjectId;
  academicLevel: string;
  subject: string;
  lessonDate: Date;
  durationMinutes: number;
  studentCount: number;
  canOverride: boolean;
}) {
  const manualAmount = amountToMinor(body.manualPrice ?? body.manualPriceOverride);
  if (manualAmount !== null && manualAmount > 0) {
    if (!base.canOverride) throw new Error("Manual price override is not permitted");
    const reason = trim(body.manualPriceOverrideReason);
    if (!reason) throw new Error("Manual price override reason is required");
    return {
      method: "manual_override" as PrivateLessonPricingMethod,
      baseAmountMinor: manualAmount,
      finalAmountMinor: manualAmount,
      currency: "DZD",
      durationMinutes: base.durationMinutes,
      studentCount: base.studentCount,
      manualOverride: true,
      manualOverrideReason: reason,
      details: { priority: "manual_override" },
    };
  }

  const config = await getActivePricing(base);
  if (!config) throw new Error("No active private lesson pricing configuration found");
  const finalAmountMinor = calculateByMethod(config, base.durationMinutes, base.studentCount);
  if (finalAmountMinor <= 0) throw new Error("Resolved private lesson price must be greater than zero");
  return {
    method: (config.configurationType === "teacher_specific" ? "teacher_rate" : config.pricingMethod) as PrivateLessonPricingMethod,
    configurationId: config._id,
    baseAmountMinor: config.amountMinor,
    finalAmountMinor,
    currency: config.currency || "DZD",
    durationMinutes: base.durationMinutes,
    studentCount: base.studentCount,
    manualOverride: false,
    details: {
      configurationType: config.configurationType,
      pricingMethod: config.pricingMethod,
      priority: config.configurationType,
    },
  };
}

function resolveCompensation(params: {
  body: Record<string, unknown>;
  teacher: { adminShare?: number; salaryConfig?: { type?: string; hourlyRate?: number; sessionRate?: number } };
  revenueMinor: number;
  durationMinutes: number;
  studentCount: number;
  canOverride: boolean;
}) {
  const manual = amountToMinor(params.body.manualCompensation);
  if (manual !== null && manual >= 0) {
    if (!params.canOverride) throw new Error("Manual compensation override is not permitted");
    const reason = trim(params.body.manualCompensationReason);
    if (!reason) throw new Error("Manual compensation override reason is required");
    return {
      method: "manual_override" as PrivateLessonCompensationMethod,
      amountMinor: manual,
      academyShareMinor: Math.max(0, params.revenueMinor - manual),
      status: "pending" as const,
      paymentStatus: "pending" as const,
      approvalStatus: "pending" as const,
      manualOverride: true,
      manualOverrideReason: reason,
      details: { reason },
    };
  }

  const config = params.teacher.salaryConfig;
  let method: PrivateLessonCompensationMethod = "percentage";
  let amountMinor = 0;
  if (config?.type === "hourly" && config.hourlyRate) {
    method = "hourly";
    amountMinor = Math.round(amountToMinor(config.hourlyRate)! * params.durationMinutes / 60);
  } else if ((config?.type === "per_session" || config?.type === "fixed") && config.sessionRate) {
    method = "fixed";
    amountMinor = amountToMinor(config.sessionRate)!;
  } else {
    const teacherShare = Math.max(0, Math.min(100, 100 - Number(params.teacher.adminShare ?? 30)));
    amountMinor = Math.round((params.revenueMinor * teacherShare) / 100);
  }
  amountMinor = Math.min(params.revenueMinor, Math.max(0, amountMinor));
  return {
    method,
    amountMinor,
    academyShareMinor: Math.max(0, params.revenueMinor - amountMinor),
    status: "pending" as const,
    paymentStatus: "pending" as const,
    approvalStatus: "pending" as const,
    manualOverride: false,
    details: { teacherSalaryConfig: config ?? null, adminShare: params.teacher.adminShare ?? null },
  };
}

async function loadValidStudents(studentIds: mongoose.Types.ObjectId[], allowInactive: boolean) {
  const students = await User.find({ _id: { $in: studentIds }, role: "student" }).select("-password").lean();
  if (students.length !== studentIds.length) throw new Error("One or more students were not found");
  for (const student of students) {
    if (!allowInactive && (!student.isActive || ["archived", "suspended"].includes(String(student.status)))) {
      throw new Error("Inactive or archived students cannot be assigned without permission");
    }
  }
  return students;
}

async function validateTeacher(teacherId: mongoose.Types.ObjectId, subject: string, academicLevel: string) {
  const teacher = await Teacher.findById(teacherId).lean();
  if (!teacher || teacher.deletedAt) throw new Error("Teacher is inactive, unavailable, suspended, or resigned");
  if (!teacher.isActive) throw new Error("teacher_inactive");
  if (teacher.status === "on_leave") throw new Error("teacher_on_leave");
  if (teacher.status === "suspended") throw new Error("teacher_suspended");
  if (teacher.status === "resigned") throw new Error("teacher_resigned");
  if (teacher.status !== "active") throw new Error("Teacher is inactive, unavailable, suspended, or resigned");
  const subjects = Array.isArray(teacher.subjects) && teacher.subjects.length ? teacher.subjects : [teacher.subject];
  if (subjects.length && !subjects.includes(subject)) throw new Error("Teacher is not assigned to this subject");
  const levels = Array.isArray(teacher.academicLevels) ? teacher.academicLevels : [];
  if (levels.length && !levels.includes(academicLevel) && teacher.teachingLevel !== academicLevel) {
    throw new Error("Teacher is not assigned to this academic level");
  }
  return teacher;
}

async function ensureNoConflicts(params: {
  lessonId?: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  studentIds: mongoose.Types.ObjectId[];
  room?: string;
  startAt: Date;
  endAt: Date;
}) {
  const baseFilter: Record<string, unknown> = {
    status: { $in: CONFLICT_STATUSES },
    startAt: { $lt: params.endAt },
    endAt: { $gt: params.startAt },
    deletedAt: null,
  };
  if (params.lessonId) baseFilter._id = { $ne: params.lessonId };

  const teacherConflict = await PrivateLesson.exists({ ...baseFilter, teacherId: params.teacherId });
  if (teacherConflict) throw new Error("teacher_conflict");
  const studentConflict = await PrivateLesson.exists({ ...baseFilter, "students.studentId": { $in: params.studentIds } });
  if (studentConflict) throw new Error("student_conflict");
  if (params.room) {
    const roomConflict = await PrivateLesson.exists({ ...baseFilter, room: params.room });
    if (roomConflict) throw new Error("Room has an overlapping private lesson");
  }

  const teacher = await Teacher.findById(params.teacherId).lean();
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const day = dayNames[params.startAt.getDay()];
  const startMin = params.startAt.getHours() * 60 + params.startAt.getMinutes();
  const endMin = params.endAt.getHours() * 60 + params.endAt.getMinutes();
  const weeklyConflict = teacher?.weeklySchedule?.some((item) => {
    const itemDay = String(item.day || "").toLowerCase();
    if (itemDay !== day) return false;
    const itemStart = parseTimeToMinutes(item.startTime);
    const itemEnd = parseTimeToMinutes(item.endTime);
    return itemStart !== null && itemEnd !== null && itemStart < endMin && itemEnd > startMin;
  });
  if (weeklyConflict) throw new Error("teacher_conflict");

  const courseConflict = await Course.exists({
    $and: [
      { $or: [{ teacher: params.teacherId }, ...(params.room ? [{ room: params.room }] : [])] },
      { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: params.startAt } }] },
    ],
    isActive: true,
    deletedAt: null,
    startDate: { $lte: params.endAt },
    startTime: { $lt: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}` },
    endTime: { $gt: `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}` },
  });
  if (courseConflict) throw new Error("teacher_conflict");
}

function lessonPaymentStatus(students: { chargeId?: mongoose.Types.ObjectId }[], charges: { _id: mongoose.Types.ObjectId; status: string; balanceMinor: number; paidAmountMinor: number }[]): PrivateLessonPaymentStatus {
  if (!charges.length) return "unpaid";
  if (charges.every((charge) => charge.status === "cancelled")) return "cancelled";
  if (charges.every((charge) => charge.status === "exempted")) return "exempted";
  if (charges.every((charge) => charge.status === "refunded")) return "refunded";
  const totalBalance = charges.reduce((sum, charge) => sum + charge.balanceMinor, 0);
  const totalPaid = charges.reduce((sum, charge) => sum + charge.paidAmountMinor, 0);
  if (totalBalance <= 0) return "paid";
  if (totalPaid > 0) return "partially_paid";
  return students.length ? "unpaid" : "unpaid";
}

export async function syncPrivateLessonPaymentStatus(lessonId: string) {
  const id = objectId(lessonId);
  if (!id) throw new Error("Invalid lesson id");
  await connectDB();
  const lesson = await PrivateLesson.findById(id);
  if (!lesson) throw new Error("Private lesson not found");
  const chargeIds = lesson.students.map((student) => student.chargeId).filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const charges = chargeIds.length ? await StudentCharge.find({ _id: { $in: chargeIds } }).lean() : [];
  lesson.paymentStatus = lessonPaymentStatus(lesson.students, charges as never);
  await lesson.save();
  return formatPrivateLesson(lesson);
}

export function formatPrivateLesson(row: unknown) {
  const record = row as Record<string, unknown>;
  const teacher = record.teacherId as { _id?: unknown; name?: string; subject?: string } | undefined;
  const replacement = record.replacementTeacherId as { _id?: unknown; name?: string } | undefined;
  const students = Array.isArray(record.students) ? record.students as Record<string, unknown>[] : [];
  const pricing = record.pricing as Record<string, unknown>;
  const compensation = record.compensation as Record<string, unknown>;
  const chargeSnapshots = students
    .map((student) => student.chargeId as Record<string, unknown> | undefined)
    .filter((charge) => charge && typeof charge === "object");
  const paidAmount = chargeSnapshots.length
    ? minorToAmount(chargeSnapshots.reduce((sum, charge) => sum + Number(charge?.paidAmountMinor || 0), 0))
    : 0;
  const remainingAmount = chargeSnapshots.length
    ? minorToAmount(chargeSnapshots.reduce((sum, charge) => sum + Number(charge?.balanceMinor || 0), 0))
    : minorToAmount(pricing?.finalAmountMinor);
  return {
    _id: String(record._id),
    students: students.map((student) => ({
      studentId: student.studentId?.toString?.() ?? student.studentId,
      name: student.name,
      phone: student.phone ?? "",
      academicLevel: student.academicLevel ?? "",
      status: student.status ?? "",
      chargeId: (student.chargeId as { _id?: unknown })?._id?.toString?.() ?? student.chargeId?.toString?.() ?? student.chargeId ?? "",
      attendanceStatus: student.attendanceStatus ?? "pending",
    })),
    teacherId: teacher?._id?.toString?.() ?? record.teacherId?.toString?.() ?? record.teacherId,
    teacherName: teacher?.name ?? "",
    replacementTeacherId: replacement?._id?.toString?.() ?? record.replacementTeacherId?.toString?.() ?? record.replacementTeacherId ?? "",
    replacementTeacherName: replacement?.name ?? "",
    subject: record.subject,
    academicLevel: record.academicLevel,
    academicSeason: record.academicSeason ?? "",
    lessonDate: toIso(record.lessonDate),
    startTime: record.startTime,
    endTime: record.endTime,
    startAt: toIso(record.startAt),
    endAt: toIso(record.endAt),
    durationMinutes: record.durationMinutes,
    room: record.room ?? "",
    location: record.location ?? "",
    onlineMeetingLink: record.onlineMeetingLink ?? "",
    format: record.format,
    status: record.status,
    studentAttendanceStatus: record.studentAttendanceStatus,
    teacherAttendanceStatus: record.teacherAttendanceStatus,
    price: minorToAmount(pricing?.finalAmountMinor),
    priceMinor: pricing?.finalAmountMinor ?? 0,
    paidAmount,
    remainingAmount,
    pricing,
    teacherCompensation: minorToAmount(compensation?.amountMinor),
    academyShare: minorToAmount(compensation?.academyShareMinor),
    compensation,
    paymentStatus: record.paymentStatus,
    notes: record.notes ?? "",
    cancellation: record.cancellation ?? null,
    seriesId: record.seriesId?.toString?.() ?? record.seriesId ?? "",
    isRecurring: Boolean(record.isRecurring),
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export async function createPrivateLesson(body: Record<string, unknown>, userId: string, options: { canPriceOverride?: boolean; canCompensationOverride?: boolean; canAssignInactive?: boolean } = {}) {
  await connectDB();
  const teacherId = objectId(body.teacherId);
  if (!teacherId) throw new Error("Teacher is required");
  const studentIds = Array.isArray(body.studentIds) ? body.studentIds.map(objectId).filter(Boolean) as mongoose.Types.ObjectId[] : [];
  if (!studentIds.length) throw new Error("At least one student is required");
  if (new Set(studentIds.map(String)).size !== studentIds.length) throw new Error("Duplicate students are not allowed in the same lesson");

  const subject = trim(body.subject);
  const academicLevel = trim(body.academicLevel);
  const lessonDate = validDate(body.lessonDate);
  const startTime = trim(body.startTime);
  const endTime = trim(body.endTime);
  const format = String(body.format || "individual") as PrivateLessonFormat;
  if (!subject || !academicLevel || !lessonDate || !startTime || !endTime) throw new Error("Lesson subject, level, date, start time, and end time are required");
  if (!PRIVATE_LESSON_FORMATS.includes(format)) throw new Error("Invalid private lesson format");
  if (format === "individual" && studentIds.length !== 1) throw new Error("Individual private lessons must have exactly one student");

  const startAt = combineDateTime(lessonDate, startTime);
  const endAt = combineDateTime(lessonDate, endTime);
  if (!startAt || !endAt || endAt <= startAt) throw new Error("Invalid lesson time range");
  const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000);

  const teacher = await validateTeacher(teacherId, subject, academicLevel);
  const students = await loadValidStudents(studentIds, Boolean(options.canAssignInactive));
  await ensureNoConflicts({ teacherId, studentIds, room: trim(body.room), startAt, endAt });
  const pricing = await resolvePricing(body, { teacherId, academicLevel, subject, lessonDate: startAt, durationMinutes, studentCount: studentIds.length, canOverride: Boolean(options.canPriceOverride) });
  const compensation = resolveCompensation({ body, teacher, revenueMinor: pricing.finalAmountMinor, durationMinutes, studentCount: studentIds.length, canOverride: Boolean(options.canCompensationOverride) });

  const lesson = await runLessonMutation(async (session) => {
    const created = new PrivateLesson({
      students: students.map((student) => ({
        studentId: student._id,
        name: student.name,
        phone: student.phone,
        academicLevel: student.academicLevel ?? student.studyLevel,
        status: student.status,
        attendanceStatus: "pending",
      })),
      teacherId,
      subject,
      academicLevel,
      academicSeason: trim(body.academicSeason),
      lessonDate: dateOnly(lessonDate),
      startTime,
      endTime,
      startAt,
      endAt,
      durationMinutes,
      room: trim(body.room),
      location: trim(body.location),
      onlineMeetingLink: trim(body.onlineMeetingLink),
      format,
      status: (body.status && PRIVATE_LESSON_STATUSES.includes(String(body.status) as PrivateLessonStatus) ? body.status : "scheduled") as PrivateLessonStatus,
      pricing,
      compensation,
      paymentStatus: "unpaid",
      notes: trim(body.notes),
      isRecurring: Boolean(body.seriesId),
      seriesId: body.seriesId ? objectId(body.seriesId) ?? undefined : undefined,
      recurringIndex: Number.isInteger(body.recurringIndex) ? Number(body.recurringIndex) : undefined,
      createdBy: userId,
    });
    await created.save({ session });
    return created;
  });

  if (BILLABLE_LESSON_STATUSES.includes(lesson.status)) {
    for (const student of lesson.students) {
      if (student.chargeId) continue;
      const charge = await createStudentCharge({
        studentId: student.studentId.toString(),
        chargeType: "private_lesson",
        description: `Private lesson - ${lesson.subject}`,
        originalAmount: minorToAmount(Math.round(lesson.pricing.finalAmountMinor / lesson.students.length)),
        dueDate: lesson.startAt.toISOString(),
        academicSeason: lesson.academicSeason,
        relatedRecordType: "private_lesson",
        relatedRecordId: lesson._id.toString(),
        serviceKey: lesson._id.toString(),
        notes: lesson.notes,
      }, userId);
      student.chargeId = new mongoose.Types.ObjectId(charge._id);
    }
    await lesson.save();
  }

  const amountPaidMinor = amountToMinor(body.amountPaid);
  if (amountPaidMinor && amountPaidMinor > 0) {
    if (amountPaidMinor > lesson.pricing.finalAmountMinor) throw new Error("Amount paid cannot exceed lesson price");
    let allocatedMinor = 0;
    for (const [index, student] of lesson.students.entries()) {
      if (!student.chargeId) continue;
      const shareMinor = index === lesson.students.length - 1
        ? amountPaidMinor - allocatedMinor
        : Math.floor(amountPaidMinor / lesson.students.length);
      allocatedMinor += shareMinor;
      const share = minorToAmount(shareMinor);
      await createStudentPayment({
        studentId: student.studentId.toString(),
        amount: share,
        paymentDate: body.paymentDate || new Date().toISOString(),
        paymentMethod: body.paymentMethod || "cash",
        academicSeason: lesson.academicSeason,
        allocations: [{ chargeId: student.chargeId.toString(), amount: share }],
        notes: `دفع حصة خاصة - ${lesson.subject}`,
        idempotencyKey: body.idempotencyKey ? `${body.idempotencyKey}-${student.chargeId.toString()}` : undefined,
      }, userId);
    }
  }

  await recordFinancialAudit({
    userId,
    action: pricing.manualOverride ? "private_lesson.manual_price_override" : "private_lesson.create",
    recordType: "private_lesson",
    recordId: lesson._id.toString(),
    metadata: { newValues: formatPrivateLesson(lesson), pricing },
  });

  return syncPrivateLessonPaymentStatus(lesson._id.toString());
}

export async function updatePrivateLesson(lessonId: string, body: Record<string, unknown>, userId: string, options: { canPriceOverride?: boolean; canCompensationOverride?: boolean } = {}) {
  const id = objectId(lessonId);
  if (!id) throw new Error("Invalid lesson id");
  await connectDB();
  const lesson = await PrivateLesson.findById(id);
  if (!lesson) throw new Error("Private lesson not found");
  if (lesson.status === "completed") throw new Error("Completed private lessons cannot be edited; create an adjustment instead");
  const previousValues = formatPrivateLesson(lesson);

  const teacherId = body.teacherId ? objectId(body.teacherId) : lesson.teacherId;
  if (!teacherId) throw new Error("Teacher is required");
  const studentIds = Array.isArray(body.studentIds) ? body.studentIds.map(objectId).filter(Boolean) as mongoose.Types.ObjectId[] : lesson.students.map((student) => student.studentId);
  if (!studentIds.length || new Set(studentIds.map(String)).size !== studentIds.length) throw new Error("Invalid student list");
  const subject = trim(body.subject) || lesson.subject;
  const academicLevel = trim(body.academicLevel) || lesson.academicLevel;
  const lessonDate = validDate(body.lessonDate) ?? lesson.lessonDate;
  const startTime = trim(body.startTime) || lesson.startTime;
  const endTime = trim(body.endTime) || lesson.endTime;
  const startAt = combineDateTime(lessonDate, startTime);
  const endAt = combineDateTime(lessonDate, endTime);
  if (!startAt || !endAt || endAt <= startAt) throw new Error("Invalid lesson time range");
  await validateTeacher(teacherId, subject, academicLevel);
  const students = await loadValidStudents(studentIds, true);
  await ensureNoConflicts({ lessonId: id, teacherId, studentIds, room: trim(body.room) || lesson.room, startAt, endAt });

  lesson.teacherId = teacherId;
  lesson.subject = subject;
  lesson.academicLevel = academicLevel;
  lesson.academicSeason = trim(body.academicSeason) || lesson.academicSeason;
  lesson.lessonDate = dateOnly(lessonDate);
  lesson.startTime = startTime;
  lesson.endTime = endTime;
  lesson.startAt = startAt;
  lesson.endAt = endAt;
  lesson.durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000);
  lesson.room = trim(body.room);
  lesson.location = trim(body.location);
  lesson.onlineMeetingLink = trim(body.onlineMeetingLink);
  lesson.notes = trim(body.notes);
  lesson.updatedBy = new mongoose.Types.ObjectId(userId);
  lesson.students = students.map((student) => {
    const existing = lesson.students.find((item) => item.studentId.toString() === student._id.toString());
    return {
      studentId: student._id,
      name: student.name,
      phone: student.phone,
      academicLevel: student.academicLevel ?? student.studyLevel,
      status: student.status,
      chargeId: existing?.chargeId,
      attendanceStatus: existing?.attendanceStatus ?? "pending",
    };
  });

  if (body.manualPrice !== undefined || body.manualPriceOverride !== undefined || body.recalculatePricing === true) {
    const teacher = await validateTeacher(teacherId, subject, academicLevel);
    lesson.pricing = await resolvePricing(body, { teacherId, academicLevel, subject, lessonDate: startAt, durationMinutes: lesson.durationMinutes, studentCount: studentIds.length, canOverride: Boolean(options.canPriceOverride) });
    lesson.compensation = resolveCompensation({ body, teacher, revenueMinor: lesson.pricing.finalAmountMinor, durationMinutes: lesson.durationMinutes, studentCount: studentIds.length, canOverride: Boolean(options.canCompensationOverride) });
  }
  await lesson.save();
  await recordFinancialAudit({ userId, action: "private_lesson.update", recordType: "private_lesson", recordId: lesson._id.toString(), metadata: { previousValues, newValues: formatPrivateLesson(lesson) } });
  return formatPrivateLesson(lesson);
}

export async function cancelPrivateLesson(lessonId: string, body: Record<string, unknown>, userId: string) {
  const id = objectId(lessonId);
  if (!id) throw new Error("Invalid lesson id");
  await connectDB();
  const lesson = await PrivateLesson.findById(id);
  if (!lesson) throw new Error("Private lesson not found");
  if (lesson.status === "completed") throw new Error("Completed private lessons cannot be cancelled");
  const reason = trim(body.reason);
  if (!reason) throw new Error("Cancellation reason is required");
  const previousValues = formatPrivateLesson(lesson);
  lesson.status = "cancelled";
  lesson.paymentStatus = "cancelled";
  lesson.compensation.status = body.teacherCompensationEligibility === "full" ? "pending" : "cancelled";
  lesson.compensation.paymentStatus = lesson.compensation.status;
  lesson.cancellation = {
    cancelledBy: new mongoose.Types.ObjectId(userId),
    cancellationDate: new Date(),
    cancelledByType: (body.cancelledByType || "admin") as never,
    reason,
    refundEligibility: (body.refundEligibility || "none") as never,
    teacherCompensationEligibility: (body.teacherCompensationEligibility || "none") as never,
    reschedulingStatus: (body.reschedulingStatus || "not_required") as never,
    chargePolicy: (body.chargePolicy || "no_charge") as never,
    notes: trim(body.notes),
  };
  await lesson.save();
  const chargeIds = lesson.students.map((student) => student.chargeId).filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  if (body.chargePolicy === "no_charge" && chargeIds.length) {
    await StudentCharge.updateMany({ _id: { $in: chargeIds }, paidAmountMinor: 0 }, { status: "cancelled", cancellationReason: reason, cancelledAt: new Date(), cancelledBy: userId });
  }
  await recordFinancialAudit({ userId, action: "private_lesson.cancel", recordType: "private_lesson", recordId: lesson._id.toString(), metadata: { previousValues, newValues: formatPrivateLesson(lesson) } });
  return syncPrivateLessonPaymentStatus(lesson._id.toString());
}

export async function postponePrivateLesson(lessonId: string, body: Record<string, unknown>, userId: string) {
  const id = objectId(lessonId);
  if (!id) throw new Error("Invalid lesson id");
  const newDate = validDate(body.lessonDate);
  const startTime = trim(body.startTime);
  const endTime = trim(body.endTime);
  if (!newDate || !startTime || !endTime) throw new Error("New date and time are required");
  await connectDB();
  const lesson = await PrivateLesson.findById(id);
  if (!lesson) throw new Error("Private lesson not found");
  const startAt = combineDateTime(newDate, startTime);
  const endAt = combineDateTime(newDate, endTime);
  if (!startAt || !endAt || endAt <= startAt) throw new Error("Invalid postponed time range");
  await ensureNoConflicts({ lessonId: id, teacherId: lesson.teacherId, studentIds: lesson.students.map((s) => s.studentId), room: lesson.room, startAt, endAt });
  const previousValues = formatPrivateLesson(lesson);
  lesson.status = "postponed";
  lesson.postponedFrom = lesson.startAt;
  lesson.postponedReason = trim(body.reason);
  lesson.lessonDate = dateOnly(newDate);
  lesson.startTime = startTime;
  lesson.endTime = endTime;
  lesson.startAt = startAt;
  lesson.endAt = endAt;
  lesson.durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000);
  lesson.updatedBy = new mongoose.Types.ObjectId(userId);
  await lesson.save();
  await recordFinancialAudit({ userId, action: "private_lesson.postpone", recordType: "private_lesson", recordId: lesson._id.toString(), metadata: { previousValues, newValues: formatPrivateLesson(lesson) } });
  return formatPrivateLesson(lesson);
}

export async function completePrivateLesson(lessonId: string, body: Record<string, unknown>, userId: string) {
  const id = objectId(lessonId);
  if (!id) throw new Error("Invalid lesson id");
  await connectDB();
  const lesson = await PrivateLesson.findById(id);
  if (!lesson) throw new Error("Private lesson not found");
  const previousValues = formatPrivateLesson(lesson);
  lesson.status = "completed";
  lesson.compensation.status = "pending";
  lesson.compensation.paymentStatus = "pending";
  lesson.updatedBy = new mongoose.Types.ObjectId(userId);
  await lesson.save();
  await TeacherLessonCompensation.findOneAndUpdate(
    { lessonId: lesson._id },
    {
      teacherId: lesson.replacementTeacherId ?? lesson.teacherId,
      originalTeacherId: lesson.originalTeacherId ?? lesson.teacherId,
      amountMinor: lesson.compensation.amountMinor,
      academyShareMinor: lesson.compensation.academyShareMinor,
      revenueMinor: lesson.pricing.finalAmountMinor,
      method: lesson.compensation.method,
      calculationSnapshot: lesson.compensation.details ?? {},
      status: "pending",
      approvalStatus: "pending",
      paymentStatus: "pending",
      salaryPeriod: trim(body.salaryPeriod) || lesson.startAt.toISOString().slice(0, 7),
      createdBy: userId,
      updatedBy: userId,
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  await recordFinancialAudit({ userId, action: "private_lesson.complete", recordType: "private_lesson", recordId: lesson._id.toString(), metadata: { previousValues, newValues: formatPrivateLesson(lesson) } });
  return formatPrivateLesson(lesson);
}

export async function recordPrivateLessonAttendance(lessonId: string, body: Record<string, unknown>, userId: string) {
  const id = objectId(lessonId);
  if (!id) throw new Error("Invalid lesson id");
  await connectDB();
  const lesson = await PrivateLesson.findById(id);
  if (!lesson) throw new Error("Private lesson not found");
  const previousValues = formatPrivateLesson(lesson);
  const studentAttendance = Array.isArray(body.studentAttendance) ? body.studentAttendance as Record<string, unknown>[] : [];
  for (const row of studentAttendance) {
    const sid = String(row.studentId || "");
    const status = String(row.status || "pending") as StudentLessonAttendanceStatus;
    const student = lesson.students.find((item) => item.studentId.toString() === sid);
    if (student) student.attendanceStatus = status;
  }
  lesson.studentAttendanceStatus = lesson.students.every((s) => s.attendanceStatus === "present") ? "present" : lesson.students.some((s) => s.attendanceStatus !== "pending") ? lesson.students[0].attendanceStatus : "pending";
  lesson.teacherAttendanceStatus = String(body.teacherStatus || lesson.teacherAttendanceStatus) as TeacherLessonAttendanceStatus;
  await lesson.save();
  await PrivateLessonAttendance.findOneAndUpdate(
    { lessonId: lesson._id },
    {
      studentAttendance: studentAttendance.map((item) => ({ ...item, studentId: objectId(item.studentId) })),
      teacherId: lesson.replacementTeacherId ?? lesson.teacherId,
      teacherStatus: lesson.teacherAttendanceStatus,
      teacherCheckInTime: validDate(body.teacherCheckInTime) ?? undefined,
      teacherCheckOutTime: validDate(body.teacherCheckOutTime) ?? undefined,
      recordedBy: userId,
      notes: trim(body.notes),
      $push: { modificationHistory: { updatedBy: userId, updatedAt: new Date(), body } },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  await recordFinancialAudit({ userId, action: "private_lesson.attendance", recordType: "private_lesson", recordId: lesson._id.toString(), metadata: { previousValues, newValues: formatPrivateLesson(lesson) } });
  return formatPrivateLesson(lesson);
}

export async function assignReplacementTeacher(lessonId: string, body: Record<string, unknown>, userId: string) {
  const id = objectId(lessonId);
  const replacementTeacherId = objectId(body.replacementTeacherId);
  if (!id || !replacementTeacherId) throw new Error("Valid lesson and replacement teacher are required");
  await connectDB();
  const lesson = await PrivateLesson.findById(id);
  if (!lesson) throw new Error("Private lesson not found");
  await validateTeacher(replacementTeacherId, lesson.subject, lesson.academicLevel);
  await ensureNoConflicts({ lessonId: id, teacherId: replacementTeacherId, studentIds: [], room: undefined, startAt: lesson.startAt, endAt: lesson.endAt });
  const previousValues = formatPrivateLesson(lesson);
  lesson.originalTeacherId = lesson.originalTeacherId ?? lesson.teacherId;
  lesson.replacementTeacherId = replacementTeacherId;
  lesson.teacherAttendanceStatus = "replacement_teacher";
  lesson.replacementReason = trim(body.reason);
  if (!lesson.replacementReason) throw new Error("Replacement reason is required");
  lesson.updatedBy = new mongoose.Types.ObjectId(userId);
  await lesson.save();
  await recordFinancialAudit({ userId, action: "private_lesson.replacement_teacher", recordType: "private_lesson", recordId: lesson._id.toString(), metadata: { previousValues, newValues: formatPrivateLesson(lesson) } });
  return formatPrivateLesson(lesson);
}

export async function createPrivateLessonSeries(body: Record<string, unknown>, userId: string, options: { canPriceOverride?: boolean; canCompensationOverride?: boolean } = {}) {
  await connectDB();
  const startDate = validDate(body.startDate);
  if (!startDate) throw new Error("Series start date is required");
  const numberOfSessions = Math.min(60, Math.max(1, Number(body.numberOfSessions || 1)));
  const frequency = body.frequency === "custom" ? "custom" : "weekly";
  const daysOfWeek = Array.isArray(body.daysOfWeek) ? body.daysOfWeek.map(Number).filter((day) => day >= 0 && day <= 6) : [startDate.getDay()];
  const series = await PrivateLessonSeries.create({
    frequency,
    daysOfWeek,
    startDate,
    endDate: validDate(body.endDate) ?? undefined,
    numberOfSessions,
    defaultStartTime: trim(body.startTime),
    defaultEndTime: trim(body.endTime),
    teacherId: objectId(body.teacherId),
    students: Array.isArray(body.studentIds) ? body.studentIds.map(objectId).filter((id): id is mongoose.Types.ObjectId => Boolean(id)) : [],
    subject: trim(body.subject),
    academicLevel: trim(body.academicLevel),
    academicSeason: trim(body.academicSeason),
    format: String(body.format || "individual") as PrivateLessonFormat,
    room: trim(body.room),
    location: trim(body.location),
    pricingSnapshot: { method: "system_default", baseAmountMinor: 1, finalAmountMinor: 1, currency: "DZD", durationMinutes: 1, studentCount: 1, manualOverride: false },
    createdBy: userId,
  } as Record<string, unknown>);

  const createdLessons: ReturnType<typeof formatPrivateLesson>[] = [];
  const cursor = new Date(startDate);
  while (createdLessons.length < numberOfSessions) {
    if (daysOfWeek.includes(cursor.getDay())) {
      const lesson = await createPrivateLesson({ ...body, lessonDate: cursor.toISOString().slice(0, 10), seriesId: series._id.toString(), recurringIndex: createdLessons.length }, userId, options);
      createdLessons.push(lesson);
    }
    cursor.setDate(cursor.getDate() + 1);
    if (body.endDate && cursor > new Date(String(body.endDate))) break;
  }
  series.pricingSnapshot = (createdLessons[0]?.pricing ?? series.pricingSnapshot) as never;
  await series.save();
  await recordFinancialAudit({ userId, action: "private_lesson_series.create", recordType: "private_lesson_series", recordId: series._id.toString(), metadata: { sessions: createdLessons.length } });
  return { series: { _id: series._id.toString(), status: series.status, numberOfSessions: createdLessons.length }, lessons: createdLessons };
}

export async function createPrivateLessonPricing(body: Record<string, unknown>, userId: string) {
  const amountMinor = amountToMinor(body.price ?? body.amount);
  const effectiveDate = validDate(body.effectiveDate);
  if (!amountMinor || amountMinor <= 0 || !effectiveDate) throw new Error("Valid price and effective date are required");
  await connectDB();
  const config = await PrivateLessonPricing.create({
    configurationType: String(body.configurationType || "academic_level_default"),
    academicLevel: trim(body.academicLevel),
    teacherId: body.teacherId ? objectId(body.teacherId) ?? undefined : undefined,
    subject: trim(body.subject),
    pricingMethod: String(body.pricingMethod || "fixed"),
    amountMinor,
    currency: trim(body.currency) || "DZD",
    effectiveDate,
    expirationDate: validDate(body.expirationDate) ?? undefined,
    isActive: body.isActive !== false,
    createdBy: userId,
  } as Record<string, unknown>);
  await recordFinancialAudit({ userId, action: "private_lesson_pricing.create", recordType: "private_lesson_pricing", recordId: config._id.toString(), metadata: { newValues: formatPricing(config) } });
  return formatPricing(config);
}

export function formatPricing(row: unknown) {
  const record = row as Record<string, unknown>;
  return {
    _id: String(record._id),
    configurationType: record.configurationType,
    academicLevel: record.academicLevel ?? "",
    teacherId: record.teacherId?.toString?.() ?? record.teacherId ?? "",
    subject: record.subject ?? "",
    pricingMethod: record.pricingMethod,
    price: minorToAmount(record.amountMinor),
    amountMinor: record.amountMinor,
    currency: record.currency ?? "DZD",
    effectiveDate: toIso(record.effectiveDate),
    expirationDate: toIso(record.expirationDate),
    isActive: record.isActive !== false,
  };
}

export async function approveTeacherLessonCompensation(compensationId: string, userId: string) {
  const id = objectId(compensationId);
  if (!id) throw new Error("Invalid compensation id");
  await connectDB();
  const compensation = await TeacherLessonCompensation.findByIdAndUpdate(
    id,
    { status: "approved", approvalStatus: "approved", paymentStatus: "approved", approvedBy: userId, approvedAt: new Date(), updatedBy: userId },
    { returnDocument: "after" }
  );
  if (!compensation) throw new Error("Teacher compensation not found");
  await PrivateLesson.findByIdAndUpdate(compensation.lessonId, { "compensation.status": "approved", "compensation.approvalStatus": "approved", "compensation.paymentStatus": "approved" });
  await recordFinancialAudit({ userId, action: "private_lesson_compensation.approve", recordType: "teacher_lesson_compensation", recordId: compensation._id.toString(), metadata: { amount: minorToAmount(compensation.amountMinor) } });
  return formatCompensation(compensation);
}

export function formatCompensation(row: unknown) {
  const record = row as Record<string, unknown>;
  const teacher = record.teacherId as { _id?: unknown; name?: string } | undefined;
  return {
    _id: String(record._id),
    lessonId: record.lessonId?.toString?.() ?? record.lessonId,
    teacherId: teacher?._id?.toString?.() ?? record.teacherId?.toString?.() ?? record.teacherId,
    teacherName: teacher?.name ?? "",
    amount: minorToAmount(record.amountMinor),
    academyShare: minorToAmount(record.academyShareMinor),
    revenue: minorToAmount(record.revenueMinor),
    method: record.method,
    status: record.status,
    approvalStatus: record.approvalStatus,
    paymentStatus: record.paymentStatus,
    salaryPeriod: record.salaryPeriod ?? "",
  };
}

export async function addPrivateLessonNote(lessonId: string, body: Record<string, unknown>, userId: string) {
  const id = objectId(lessonId);
  if (!id) throw new Error("Invalid lesson id");
  if (!trim(body.note)) throw new Error("Note is required");
  await connectDB();
  const note = await PrivateLessonNote.create({
    note: trim(body.note),
    type: body.type || "lesson",
    visibility: body.visibility || "internal",
    author: userId,
    lessonId: id,
  });
  await recordFinancialAudit({ userId, action: "private_lesson.note", recordType: "private_lesson", recordId: lessonId, metadata: { noteId: note._id.toString() } });
  return { _id: note._id.toString(), note: note.note, type: note.type, visibility: note.visibility, createdAt: toIso(note.createdAt) };
}

export async function upsertPrivateLessonPerformance(lessonId: string, body: Record<string, unknown>, userId: string) {
  const id = objectId(lessonId);
  const studentId = objectId(body.studentId);
  if (!id || !studentId) throw new Error("Valid lesson and student are required");
  await connectDB();
  const lesson = await PrivateLesson.findById(id).lean();
  if (!lesson) throw new Error("Private lesson not found");
  const record = await PrivateLessonPerformance.findOneAndUpdate(
    { lessonId: id, studentId },
    {
      teacherId: lesson.replacementTeacherId ?? lesson.teacherId,
      subject: lesson.subject,
      academicSeason: lesson.academicSeason,
      objectives: trim(body.objectives),
      topicsCovered: trim(body.topicsCovered),
      homework: trim(body.homework),
      studentUnderstanding: trim(body.studentUnderstanding),
      studentParticipation: trim(body.studentParticipation),
      teacherEvaluation: trim(body.teacherEvaluation),
      progressScore: body.progressScore === undefined ? undefined : Number(body.progressScore),
      recommendations: trim(body.recommendations),
      nextLessonPlan: trim(body.nextLessonPlan),
      createdBy: userId,
      updatedBy: userId,
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  await recordFinancialAudit({ userId, action: "private_lesson.performance", recordType: "private_lesson_performance", recordId: record._id.toString(), metadata: { lessonId } });
  return { _id: record._id.toString(), progressScore: record.progressScore, topicsCovered: record.topicsCovered ?? "" };
}

export async function getPrivateLessonStats() {
  await connectDB();
  const now = new Date();
  const todayStart = dateOnly(now);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [statusAgg, revenueAgg, compAgg, todayCount, weekCount, monthCount, byTeacher, bySubject, byLevel, attendanceAgg, recent] = await Promise.all([
    PrivateLesson.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    PrivateLesson.aggregate([{ $match: { deletedAt: null, status: { $ne: "cancelled" } } }, { $group: { _id: null, revenue: { $sum: "$pricing.finalAmountMinor" } } }]),
    TeacherLessonCompensation.aggregate([{ $group: { _id: "$paymentStatus", total: { $sum: "$amountMinor" }, count: { $sum: 1 } } }]),
    PrivateLesson.countDocuments({ startAt: { $gte: todayStart, $lt: todayEnd }, deletedAt: null }),
    PrivateLesson.countDocuments({ startAt: { $gte: weekStart }, deletedAt: null }),
    PrivateLesson.countDocuments({ startAt: { $gte: monthStart }, deletedAt: null }),
    PrivateLesson.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: "$teacherId", count: { $sum: 1 }, revenue: { $sum: "$pricing.finalAmountMinor" } } }, { $lookup: { from: "teachers", localField: "_id", foreignField: "_id", as: "teacher" } }, { $unwind: { path: "$teacher", preserveNullAndEmptyArrays: true } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    PrivateLesson.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: "$subject", count: { $sum: 1 }, revenue: { $sum: "$pricing.finalAmountMinor" } } }, { $sort: { count: -1 } }]),
    PrivateLesson.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: "$academicLevel", count: { $sum: 1 }, revenue: { $sum: "$pricing.finalAmountMinor" } } }, { $sort: { count: -1 } }]),
    PrivateLesson.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: "$studentAttendanceStatus", count: { $sum: 1 } } }]),
    PrivateLesson.find({ deletedAt: null }).populate("teacherId", "name").sort({ updatedAt: -1 }).limit(10).lean(),
  ]);
  const statusMap = Object.fromEntries(statusAgg.map((row) => [row._id, row.count]));
  const compensationTotal = compAgg.reduce((sum, row) => sum + row.total, 0);
  return {
    totalPrivateLessons: Object.values(statusMap).reduce((sum, value) => Number(sum) + Number(value), 0),
    scheduledLessons: statusMap.scheduled ?? 0,
    completedLessons: statusMap.completed ?? 0,
    cancelledLessons: statusMap.cancelled ?? 0,
    lessonsToday: todayCount,
    lessonsThisWeek: weekCount,
    lessonsThisMonth: monthCount,
    totalPrivateLessonRevenue: minorToAmount(revenueAgg[0]?.revenue ?? 0),
    collectedRevenue: 0,
    outstandingLessonBalances: 0,
    teacherCompensationTotal: minorToAmount(compensationTotal),
    pendingTeacherCompensation: minorToAmount(compAgg.find((row) => row._id === "pending")?.total ?? 0),
    paidTeacherCompensation: minorToAmount(compAgg.find((row) => row._id === "paid")?.total ?? 0),
    lessonsByTeacher: byTeacher.map((row) => ({ teacherId: row._id?.toString(), teacherName: row.teacher?.name ?? "", count: row.count, revenue: minorToAmount(row.revenue) })),
    lessonsBySubject: bySubject.map((row) => ({ subject: row._id ?? "", count: row.count, revenue: minorToAmount(row.revenue) })),
    lessonsByAcademicLevel: byLevel.map((row) => ({ academicLevel: row._id ?? "", count: row.count, revenue: minorToAmount(row.revenue) })),
    attendanceRates: attendanceAgg,
    cancellationRate: statusMap.cancelled ? Math.round((Number(statusMap.cancelled) / Math.max(1, Object.values(statusMap).reduce<number>((sum, value) => sum + Number(value), 0))) * 100) : 0,
    recentPrivateLessonActivity: recent.map(formatPrivateLesson),
  };
}
