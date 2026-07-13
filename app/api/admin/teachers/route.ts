import { connectDB } from "@/lib/db";
import Teacher from "@/models/Teacher";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { recordAudit } from "@/lib/audit";
import { formatTeacher, notDeletedFilter } from "@/lib/academic";
import {
  buildPaginationMeta,
  parsePagination,
  parseSort,
} from "@/lib/pagination";
import type {
  TeacherAttendanceRecord,
  TeacherContract,
  TeacherDocument,
  TeacherEmploymentType,
  TeacherMoneyRecord,
  TeacherPerformanceRecord,
  TeacherQualification,
  TeacherSalaryConfig,
  TeacherScheduleItem,
  TeacherStatus,
} from "@/types";

const TEACHER_STATUSES: TeacherStatus[] = ["active", "on_leave", "suspended", "resigned"];
const EMPLOYMENT_TYPES: TeacherEmploymentType[] = ["full_time", "part_time", "contract", "visiting"];
const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;
const SALARY_TYPES = ["fixed", "hourly", "per_session"] as const;

type TeacherBody = Record<string, unknown>;

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toDate(value: unknown) {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseAdminShare(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function normalizeStringList(value: unknown, fallback: string[] = []) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : fallback;

  return [...new Set(source.map((item) => trim(item)).filter(Boolean))].slice(0, 30);
}

function normalizeStatus(value: unknown, fallback: TeacherStatus): TeacherStatus {
  return typeof value === "string" && TEACHER_STATUSES.includes(value as TeacherStatus)
    ? (value as TeacherStatus)
    : fallback;
}

function statusToIsActive(status: TeacherStatus) {
  return status === "active" || status === "on_leave";
}

function normalizeEmploymentType(value: unknown) {
  return typeof value === "string" && EMPLOYMENT_TYPES.includes(value as TeacherEmploymentType)
    ? (value as TeacherEmploymentType)
    : "part_time";
}

function sanitizeQualifications(value: unknown): TeacherQualification[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as TeacherQualification;
      const year = Number(row.year);
      return {
        degree: trim(row.degree),
        institution: trim(row.institution),
        field: trim(row.field),
        year: Number.isFinite(year) ? year : undefined,
      };
    })
    .filter((item) => item.degree)
    .slice(0, 20);
}

function sanitizeSchedule(value: unknown): TeacherScheduleItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as TeacherScheduleItem;
      return {
        day: trim(row.day),
        startTime: trim(row.startTime),
        endTime: trim(row.endTime),
        className: trim(row.className),
        subject: trim(row.subject),
        room: trim(row.room),
      };
    })
    .filter((item) => item.day && item.startTime && item.endTime)
    .slice(0, 60);
}

function sanitizeAttendance(value: unknown): TeacherAttendanceRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as TeacherAttendanceRecord;
      const status = ATTENDANCE_STATUSES.includes(row.status as never) ? row.status : "present";
      return {
        date: toDate(row.date) ?? new Date(),
        status,
        note: trim(row.note),
      };
    })
    .slice(0, 240);
}

function sanitizeMoneyRecords(value: unknown): TeacherMoneyRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as TeacherMoneyRecord;
      const amount = Number(row.amount);
      return {
        title: trim(row.title),
        amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
        date: toDate(row.date) ?? new Date(),
        note: trim(row.note),
      };
    })
    .filter((item) => item.amount >= 0)
    .slice(0, 120);
}

function sanitizeDocuments(value: unknown): TeacherDocument[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as TeacherDocument;
      return {
        title: trim(row.title),
        type: trim(row.type) || "other",
        url: trim(row.url),
        publicId: trim(row.publicId) || undefined,
        uploadedAt: toDate(row.uploadedAt) ?? new Date(),
      };
    })
    .filter((item) => item.title && item.url)
    .slice(0, 50);
}

function sanitizeContracts(value: unknown): TeacherContract[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as TeacherContract;
      const status = ["active", "expired", "terminated", "draft"].includes(String(row.status))
        ? row.status
        : "active";
      return {
        title: trim(row.title),
        type: trim(row.type) || "employment",
        status,
        startDate: toDate(row.startDate),
        endDate: toDate(row.endDate),
        url: trim(row.url),
        publicId: trim(row.publicId) || undefined,
        uploadedAt: toDate(row.uploadedAt) ?? new Date(),
      };
    })
    .filter((item) => item.title)
    .slice(0, 30);
}

function sanitizePerformanceRecords(value: unknown): TeacherPerformanceRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as TeacherPerformanceRecord;
      const rating = Number(row.rating);
      return {
        date: toDate(row.date) ?? new Date(),
        title: trim(row.title),
        rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : undefined,
        note: trim(row.note),
        createdBy: trim(row.createdBy),
      };
    })
    .filter((item) => item.title || item.note || item.rating)
    .slice(0, 80);
}

function sanitizeSalaryConfig(value: unknown): TeacherSalaryConfig {
  const raw = (value || {}) as TeacherSalaryConfig;
  const type = SALARY_TYPES.includes(raw.type as never) ? raw.type : "per_session";
  const baseSalary = Number(raw.baseSalary);
  const hourlyRate = Number(raw.hourlyRate);
  const sessionRate = Number(raw.sessionRate);

  return {
    type,
    baseSalary: Number.isFinite(baseSalary) && baseSalary >= 0 ? baseSalary : undefined,
    hourlyRate: Number.isFinite(hourlyRate) && hourlyRate >= 0 ? hourlyRate : undefined,
    sessionRate: Number.isFinite(sessionRate) && sessionRate >= 0 ? sessionRate : undefined,
    currency: trim(raw.currency) || "DZD",
    effectiveFrom: toDate(raw.effectiveFrom),
  };
}

function validateTeacherPayload(body: TeacherBody, isCreate: boolean) {
  const errors: { field: string; message: string }[] = [];
  const subjects = normalizeStringList(body.subjects, [trim(body.subject)]);
  const academicLevels = normalizeStringList(body.academicLevels, [trim(body.teachingLevel)]);

  if (isCreate || body.name !== undefined) {
    if (!trim(body.name)) errors.push({ field: "name", message: "اسم الأستاذ مطلوب" });
  }
  if (isCreate || body.phone !== undefined) {
    if (!trim(body.phone)) errors.push({ field: "phone", message: "رقم الهاتف مطلوب" });
  }
  if (isCreate && subjects.length === 0) {
    errors.push({ field: "subjects", message: "مادة واحدة على الأقل مطلوبة" });
  }
  if (isCreate && academicLevels.length === 0) {
    errors.push({ field: "academicLevels", message: "مستوى أكاديمي واحد على الأقل مطلوب" });
  }
  if (body.status && !TEACHER_STATUSES.includes(body.status as TeacherStatus)) {
    errors.push({ field: "status", message: "حالة الأستاذ غير صالحة" });
  }
  if (body.employmentType && !EMPLOYMENT_TYPES.includes(body.employmentType as TeacherEmploymentType)) {
    errors.push({ field: "employmentType", message: "نوع التوظيف غير صالح" });
  }
  if (parseAdminShare(body.adminShare) === null) {
    errors.push({ field: "adminShare", message: "نسبة الإدارة يجب أن تكون بين 0 و 100" });
  }

  return errors;
}

function teacherValidationResponse(errors: { field: string; message: string }[]) {
  return Response.json(
    { error: "بيانات الأستاذ غير مكتملة", validationErrors: errors },
    { status: 400 }
  );
}

function buildTeacherPayload(body: TeacherBody, isCreate: boolean) {
  const status = normalizeStatus(
    body.status,
    body.isActive === false ? "suspended" : "active"
  );
  const subjects = normalizeStringList(body.subjects, [trim(body.subject)]);
  const academicLevels = normalizeStringList(body.academicLevels, [trim(body.teachingLevel)]);

  const payload: Record<string, unknown> = {
    status,
    isActive: statusToIsActive(status),
    employmentType: normalizeEmploymentType(body.employmentType),
    subjects,
    subject: trim(body.subject) || subjects[0],
    academicLevels,
    teachingLevel: trim(body.teachingLevel) || academicLevels[0],
    assignedClasses: normalizeStringList(body.assignedClasses),
    qualifications: sanitizeQualifications(body.qualifications),
    weeklySchedule: sanitizeSchedule(body.weeklySchedule),
    attendance: sanitizeAttendance(body.attendance),
    salaryConfig: sanitizeSalaryConfig(body.salaryConfig),
    salaryHistory: sanitizeMoneyRecords(body.salaryHistory),
    bonuses: sanitizeMoneyRecords(body.bonuses),
    deductions: sanitizeMoneyRecords(body.deductions),
    contracts: sanitizeContracts(body.contracts),
    documents: sanitizeDocuments(body.documents),
    performanceRecords: sanitizePerformanceRecords(body.performanceRecords),
    notes: trim(body.notes),
    email: trim(body.email),
    address: trim(body.address),
    nationalId: trim(body.nationalId),
    emergencyPhone: trim(body.emergencyPhone),
    hireDate: toDate(body.hireDate),
  };

  if (body.name !== undefined || isCreate) payload.name = trim(body.name);
  if (body.phone !== undefined || isCreate) payload.phone = trim(body.phone);
  if (body.adminShare !== undefined) payload.adminShare = parseAdminShare(body.adminShare);

  return payload;
}

function buildTeacherFilter(searchParams: URLSearchParams) {
  const search = searchParams.get("search")?.trim();
  const subject = searchParams.get("subject")?.trim();
  const academicLevel = searchParams.get("academicLevel")?.trim();
  const className = searchParams.get("className")?.trim();
  const employmentType = searchParams.get("employmentType")?.trim();
  const status = searchParams.get("status")?.trim();
  const isActive = searchParams.get("isActive");
  const eligiblePrivateLessons = searchParams.get("eligiblePrivateLessons") === "true";
  const deletedOnly = searchParams.get("deletedOnly") === "true";
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  const filter: Record<string, unknown> = deletedOnly
    ? { deletedAt: { $ne: null } }
    : notDeletedFilter(includeDeleted);

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
      { subjects: { $regex: search, $options: "i" } },
      { teachingLevel: { $regex: search, $options: "i" } },
      { academicLevels: { $regex: search, $options: "i" } },
      { assignedClasses: { $regex: search, $options: "i" } },
    ];
  }
  if (subject) filter.subjects = { $regex: subject, $options: "i" };
  if (academicLevel) filter.academicLevels = { $regex: academicLevel, $options: "i" };
  if (className) filter.assignedClasses = { $regex: className, $options: "i" };
  if (employmentType && EMPLOYMENT_TYPES.includes(employmentType as TeacherEmploymentType)) {
    filter.employmentType = employmentType;
  }
  if (status && TEACHER_STATUSES.includes(status as TeacherStatus)) filter.status = status;
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;
  if (eligiblePrivateLessons) {
    filter.status = "active";
    filter.isActive = true;
    filter.deletedAt = null;
  }

  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("teachers.manage");
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(
      searchParams,
      ["name", "createdAt", "subject", "status", "employmentType"],
      "createdAt"
    );
    const filter = buildTeacherFilter(searchParams);

    await connectDB();

    const [teachers, total] = await Promise.all([
      Teacher.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
      Teacher.countDocuments(filter),
    ]);

    return successResponse({
      teachers: teachers.map((teacher) => formatTeacher(teacher)),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Admin teachers GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("teachers.manage");
    if (error) return error;

    const body = await request.json();
    const validationErrors = validateTeacherPayload(body, true);
    if (validationErrors.length) return teacherValidationResponse(validationErrors);

    await connectDB();

    const phone = trim(body.phone);
    const duplicate = await Teacher.findOne({ phone, deletedAt: null });
    if (duplicate) return errorResponse("رقم الهاتف مسجل مسبقا", 409);

    const teacher = await Teacher.create(buildTeacherPayload(body, true));

    await recordAudit({
      userId: user!._id,
      action: "teacher.create",
      recordType: "teacher",
      recordId: teacher._id.toString(),
      metadata: { status: teacher.status, subjects: teacher.subjects },
    });

    return successResponse({ teacher: formatTeacher(teacher) }, 201);
  } catch (err) {
    return handleRouteError("Admin teachers POST", err);
  }
}
