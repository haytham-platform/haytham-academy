import { connectDB } from "@/lib/db";
import Teacher from "@/models/Teacher";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { recordAudit } from "@/lib/audit";
import { formatTeacher } from "@/lib/academic";
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

function normalizeEmploymentType(value: unknown, fallback?: TeacherEmploymentType) {
  return typeof value === "string" && EMPLOYMENT_TYPES.includes(value as TeacherEmploymentType)
    ? (value as TeacherEmploymentType)
    : fallback ?? "part_time";
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

function validateTeacherPayload(body: TeacherBody) {
  const errors: { field: string; message: string }[] = [];

  if (body.name !== undefined && !trim(body.name)) {
    errors.push({ field: "name", message: "اسم الأستاذ مطلوب" });
  }
  if (body.phone !== undefined && !trim(body.phone)) {
    errors.push({ field: "phone", message: "رقم الهاتف مطلوب" });
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

function validationResponse(errors: { field: string; message: string }[]) {
  return Response.json(
    { error: "بيانات الأستاذ غير مكتملة", validationErrors: errors },
    { status: 400 }
  );
}

function buildTeacherUpdates(body: TeacherBody) {
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = trim(body.name);
  if (body.phone !== undefined) updates.phone = trim(body.phone);
  if (body.email !== undefined) updates.email = trim(body.email);
  if (body.address !== undefined) updates.address = trim(body.address);
  if (body.nationalId !== undefined) updates.nationalId = trim(body.nationalId);
  if (body.emergencyPhone !== undefined) updates.emergencyPhone = trim(body.emergencyPhone);
  if (body.hireDate !== undefined) updates.hireDate = toDate(body.hireDate);
  if (body.employmentType !== undefined) {
    updates.employmentType = normalizeEmploymentType(body.employmentType);
  }
  if (body.status !== undefined || body.isActive !== undefined) {
    const status = normalizeStatus(
      body.status,
      body.isActive === false ? "suspended" : "active"
    );
    updates.status = status;
    updates.isActive = statusToIsActive(status);
  }
  if (body.subjects !== undefined || body.subject !== undefined) {
    const subjects = normalizeStringList(body.subjects, [trim(body.subject)]);
    if (subjects.length > 0) {
      updates.subjects = subjects;
      updates.subject = trim(body.subject) || subjects[0];
    }
  }
  if (body.academicLevels !== undefined || body.teachingLevel !== undefined) {
    const academicLevels = normalizeStringList(body.academicLevels, [trim(body.teachingLevel)]);
    if (academicLevels.length > 0) {
      updates.academicLevels = academicLevels;
      updates.teachingLevel = trim(body.teachingLevel) || academicLevels[0];
    }
  }
  if (body.assignedClasses !== undefined) updates.assignedClasses = normalizeStringList(body.assignedClasses);
  if (body.qualifications !== undefined) updates.qualifications = sanitizeQualifications(body.qualifications);
  if (body.weeklySchedule !== undefined) updates.weeklySchedule = sanitizeSchedule(body.weeklySchedule);
  if (body.attendance !== undefined) updates.attendance = sanitizeAttendance(body.attendance);
  if (body.salaryConfig !== undefined) updates.salaryConfig = sanitizeSalaryConfig(body.salaryConfig);
  if (body.salaryHistory !== undefined) updates.salaryHistory = sanitizeMoneyRecords(body.salaryHistory);
  if (body.bonuses !== undefined) updates.bonuses = sanitizeMoneyRecords(body.bonuses);
  if (body.deductions !== undefined) updates.deductions = sanitizeMoneyRecords(body.deductions);
  if (body.contracts !== undefined) updates.contracts = sanitizeContracts(body.contracts);
  if (body.documents !== undefined) updates.documents = sanitizeDocuments(body.documents);
  if (body.notes !== undefined) updates.notes = trim(body.notes);
  if (body.performanceRecords !== undefined) updates.performanceRecords = sanitizePerformanceRecords(body.performanceRecords);
  if (body.adminShare !== undefined) updates.adminShare = parseAdminShare(body.adminShare);

  return updates;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requirePermission("teachers.manage");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const teacher = await Teacher.findOne({ _id: id }).lean();
    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    return successResponse({ teacher: formatTeacher(teacher) });
  } catch (err) {
    console.error("Admin teacher GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("teachers.manage");
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const validationErrors = validateTeacherPayload(body);
    if (validationErrors.length) return validationResponse(validationErrors);

    await connectDB();

    if (body.phone) {
      const duplicate = await Teacher.findOne({
        _id: { $ne: id },
        phone: trim(body.phone),
        deletedAt: null,
      });
      if (duplicate) return errorResponse("رقم الهاتف مسجل مسبقا", 409);
    }

    const teacher = await Teacher.findOneAndUpdate(
      { _id: id, deletedAt: null },
      buildTeacherUpdates(body),
      { returnDocument: "after", runValidators: true }
    );

    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    await recordAudit({
      userId: user!._id,
      action: "teacher.update",
      recordType: "teacher",
      recordId: id,
      metadata: { fields: Object.keys(body) },
    });

    return successResponse({ teacher: formatTeacher(teacher) });
  } catch (err) {
    return handleRouteError("Admin teacher PUT", err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requirePermission("teachers.manage");
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const teacher = await Teacher.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { deletedAt: new Date(), isActive: false, status: "resigned" },
      { returnDocument: "after", runValidators: true }
    );

    if (!teacher) return errorResponse("الأستاذ غير موجود", 404);

    await recordAudit({
      userId: user!._id,
      action: "teacher.archive",
      recordType: "teacher",
      recordId: id,
      metadata: { status: "resigned" },
    });

    return successResponse({
      message: "تم أرشفة الأستاذ",
      teacher: formatTeacher(teacher),
    });
  } catch (err) {
    console.error("Admin teacher DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
