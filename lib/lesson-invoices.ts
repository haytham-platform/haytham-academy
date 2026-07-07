import mongoose from "mongoose";
import Enrollment from "@/models/Enrollment";
import Course from "@/models/Course";
import LessonInvoice from "@/models/LessonInvoice";
import type { LessonPaymentStatus } from "@/models/LessonInvoice";
import {
  computeRemainingAmount,
  computeTotalAmount,
  derivePaymentStatus,
  idsMatch,
  normalizeId,
  parseMonthRange,
  parseSessionCount,
  refId,
  validateLessonInvoiceInput,
} from "@/lib/lesson-invoice-utils";

export {
  computeRemainingAmount,
  computeTotalAmount,
  derivePaymentStatus,
  idsMatch,
  normalizeId,
  parseMonthRange,
  parseSessionCount,
  refId,
  validateLessonInvoiceInput,
};

export const ACTIVE_ENROLLMENT_STATUSES = ["approved", "accepted"] as const;

type PopulatedCourse = {
  _id: { toString(): string };
  title?: string;
  teacher?: {
    _id?: { toString(): string };
    name?: string;
    subject?: string;
    adminShare?: number;
  };
};

type PopulatedEnrollment = {
  _id: { toString(): string };
  course?: PopulatedCourse | null;
};

export function formatEnrollmentContext(enrollment: PopulatedEnrollment) {
  const course = enrollment.course;
  const teacher = course?.teacher;
  const teacherDoc =
    teacher && typeof teacher === "object" && "name" in teacher ? teacher : null;
  const adminShare = teacherDoc?.adminShare ?? 0;

  return {
    enrollmentId: enrollment._id.toString(),
    courseId: refId(course?._id ?? course),
    courseTitle: course?.title ?? "",
    subject: teacherDoc?.subject ?? course?.title ?? "",
    teacherId: refId(teacher),
    teacherName: teacherDoc?.name ?? "",
    adminShare,
    teacherShare: 100 - adminShare,
  };
}

export async function getStudentEnrollmentOptions(studentId: string) {
  const enrollments = await Enrollment.find({
    student: studentId,
    status: { $in: ["approved", "accepted"] },
  } as Record<string, unknown>)
    .populate({
      path: "course",
      select: "title teacher",
      populate: {
        path: "teacher",
        select: "name subject adminShare",
        match: { deletedAt: null },
      },
    })
    .sort({ createdAt: -1 })
    .lean();

  return enrollments
    .map((e) => formatEnrollmentContext(e as PopulatedEnrollment))
    .filter((ctx) => ctx.courseId && ctx.teacherId);
}

export async function resolveStudentInvoiceContext(
  studentId: string,
  enrollmentId?: string | null
) {
  const options = await getStudentEnrollmentOptions(studentId);
  if (!options.length) {
    return { error: "لا يوجد تسجيل مقبول للطالب في أي دورة" as const, options: [] };
  }

  const selected = enrollmentId
    ? options.find((o) => o.enrollmentId === enrollmentId)
    : options[0];

  if (!selected) {
    return { error: "التسجيل المحدد غير موجود أو غير مقبول" as const, options };
  }

  return { context: selected, options };
}

export function formatLessonInvoice(row: {
  _id: { toString(): string };
  studentId: unknown;
  teacherId: unknown;
  enrollmentId?: unknown;
  courseId?: unknown;
  subject: string;
  sessionCount: number;
  pricePerSession: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: LessonPaymentStatus;
  invoiceDate: Date;
  note?: string;
  createdAt?: Date;
}) {
  const student = row.studentId as
    | { _id?: unknown; name?: string; phone?: string }
    | string
    | null;
  const teacher = row.teacherId as
    | { _id?: unknown; name?: string; subject?: string; adminShare?: number }
    | string
    | null;
  const course = row.courseId as { _id?: unknown; title?: string } | string | null;

  const studentId = refId(student);
  const studentName =
    student && typeof student === "object" && "name" in student ? student.name ?? "" : "";
  const studentPhone =
    student && typeof student === "object" && "phone" in student ? student.phone ?? "" : "";

  const teacherId = refId(teacher);
  const teacherName =
    teacher && typeof teacher === "object" && "name" in teacher ? teacher.name ?? "" : "";

  const courseTitle =
    course && typeof course === "object" && "title" in course ? course.title ?? "" : "";

  return {
    _id: row._id.toString(),
    studentId,
    studentName,
    studentPhone,
    enrollmentId: refId(row.enrollmentId),
    courseId: refId(course),
    teacherId,
    teacherName,
    courseTitle,
    subject: row.subject,
    sessionCount: row.sessionCount,
    pricePerSession: row.pricePerSession,
    totalAmount: row.totalAmount,
    paidAmount: row.paidAmount,
    remainingAmount: computeRemainingAmount(row.totalAmount, row.paidAmount),
    paymentStatus: row.paymentStatus,
    invoiceDate: row.invoiceDate,
    note: row.note ?? "",
    createdAt: row.createdAt,
  };
}

type LeanInvoice = {
  _id: mongoose.Types.ObjectId;
  teacherId?: unknown;
  courseId?: unknown;
  enrollmentId?: unknown;
  sessionCount: number;
  totalAmount: number;
};

async function teacherIdFromCourse(courseId: unknown): Promise<string> {
  const id = normalizeId(courseId);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return "";
  const course = await Course.findById(id).select("teacher").lean();
  return normalizeId(course?.teacher);
}

async function teacherIdFromEnrollment(enrollmentId: unknown): Promise<string> {
  const id = normalizeId(enrollmentId);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return "";
  const enrollment = await Enrollment.findById(id)
    .populate({ path: "course", select: "teacher" })
    .lean();
  const course = enrollment?.course as { teacher?: unknown } | null | undefined;
  return normalizeId(course?.teacher);
}

/** Resolve teacherId on a stored invoice; persist fix when inferred from course/enrollment. */
export async function resolveStoredInvoiceTeacherId(
  invoice: LeanInvoice,
  persist = true
): Promise<string> {
  const stored = normalizeId(invoice.teacherId);
  if (stored && mongoose.Types.ObjectId.isValid(stored)) {
    return stored;
  }

  let inferred = await teacherIdFromCourse(invoice.courseId);
  if (!inferred) {
    inferred = await teacherIdFromEnrollment(invoice.enrollmentId);
  }

  if (inferred && persist) {
    await LessonInvoice.updateOne(
      { _id: invoice._id },
      { $set: { teacherId: new mongoose.Types.ObjectId(inferred) } }
    );
  }

  return inferred;
}

/** Fetch invoices for teacher account — match by teacherId only (never by name). */
export async function getInvoicesForTeacherAccount(
  teacherId: string,
  month?: string | null
) {
  const selectedTeacherId = normalizeId(teacherId);
  if (!selectedTeacherId || !mongoose.Types.ObjectId.isValid(selectedTeacherId)) {
    return { selectedTeacherId, allCandidates: [], matched: [] };
  }

  const teacherObjectId = new mongoose.Types.ObjectId(selectedTeacherId);
  const courseIds = await Course.find({ teacher: teacherObjectId }).distinct("_id");

  const filter: Record<string, unknown> = {
    $or: [
      { teacherId: teacherObjectId },
      { teacherId: selectedTeacherId },
      ...(courseIds.length ? [{ courseId: { $in: courseIds } }] : []),
    ],
  };

  const { start, end } = parseMonthRange(month);
  if (start && end) {
    filter.invoiceDate = { $gte: start, $lte: end };
  }

  const allCandidates = await LessonInvoice.find(filter)
    .populate("studentId", "name phone")
    .populate("courseId", "title teacher")
    .sort({ invoiceDate: -1 })
    .lean();

  const matched: typeof allCandidates = [];
  for (const row of allCandidates) {
    let invoiceTeacherId = normalizeId(row.teacherId);
    if (!invoiceTeacherId) {
      invoiceTeacherId = await resolveStoredInvoiceTeacherId(row as LeanInvoice);
      if (invoiceTeacherId) {
        (row as { teacherId: unknown }).teacherId = invoiceTeacherId;
      }
    }
    if (!invoiceTeacherId) {
      invoiceTeacherId = normalizeId(
        (row.courseId as { teacher?: unknown } | null)?.teacher
      );
      if (invoiceTeacherId && idsMatch(invoiceTeacherId, selectedTeacherId)) {
        await LessonInvoice.updateOne(
          { _id: row._id },
          { $set: { teacherId: teacherObjectId } }
        );
        (row as { teacherId: unknown }).teacherId = selectedTeacherId;
      }
    }
    if (idsMatch(invoiceTeacherId, selectedTeacherId)) {
      matched.push(row);
    }
  }

  return { selectedTeacherId, allCandidates, matched };
}

export function computeTeacherAccount(
  teacher: {
    _id: { toString(): string };
    name: string;
    subject: string;
    adminShare?: number;
  },
  invoices: {
    sessionCount: number;
    totalAmount: number;
  }[]
) {
  const adminShare = teacher.adminShare ?? 0;
  const teacherShare = 100 - adminShare;

  const sessionCounts = { one: 0, two: 0, three: 0, four: 0 };
  for (const inv of invoices) {
    if (inv.sessionCount === 1) sessionCounts.one += 1;
    else if (inv.sessionCount === 2) sessionCounts.two += 1;
    else if (inv.sessionCount === 3) sessionCounts.three += 1;
    else if (inv.sessionCount === 4) sessionCounts.four += 1;
  }

  const totalStudents = invoices.length;
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const adminShareAmount = (totalRevenue * adminShare) / 100;
  const teacherShareAmount = (totalRevenue * teacherShare) / 100;

  return {
    teacher: {
      _id: normalizeId(teacher._id),
      name: teacher.name,
      subject: teacher.subject,
      adminShare,
      teacherShare,
    },
    sessionCounts,
    totalStudents,
    totalRevenue,
    adminShareAmount,
    teacherShareAmount,
  };
}
