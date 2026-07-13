import mongoose from "mongoose";
import User from "@/models/User";
import Enrollment from "@/models/Enrollment";
import Payment from "@/models/Payment";
import { StudentCharge, StudentPayment } from "@/models/StudentFinance";
import {
  Guardian,
  StudentAttendance,
  StudentBehavior,
  StudentCommunication,
  StudentGuardianLink,
  StudentNote,
  StudentPerformance,
  StudentRolloverAudit,
} from "@/models/StudentRecords";
import type {
  IStudentAttendance,
  IStudentBehavior,
  IStudentCommunication,
  IStudentNote,
  IStudentPerformance,
} from "@/models/StudentRecords";
import { connectDB } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { formatStudent } from "@/lib/academic";
import { minorToAmount } from "@/lib/student-finance";
import type { StudentStatus } from "@/types";

export const STUDENT_STATUSES: StudentStatus[] = ["active", "pending", "suspended", "withdrawn", "graduated", "archived"];
export const ENROLLMENT_TYPES = ["regular", "support_lessons", "private_lessons", "exam_preparation", "kindergarten", "language_courses", "training_courses", "other"];

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function objectId(value: unknown) {
  const str = String(value || "");
  return mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : null;
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

export function normalizeStudentStatus(value: unknown, fallback: StudentStatus): StudentStatus {
  return typeof value === "string" && STUDENT_STATUSES.includes(value as StudentStatus) ? value as StudentStatus : fallback;
}

export function statusToIsActive(status: StudentStatus) {
  return status === "active" || status === "pending";
}

export async function generateStudentNumber() {
  await connectDB();
  const year = new Date().getFullYear();
  for (let i = 0; i < 10; i += 1) {
    const count = await User.countDocuments({ role: "student", studentNumber: { $regex: `^HA-${year}-` } });
    const studentNumber = `HA-${year}-${String(count + i + 1).padStart(5, "0")}`;
    const exists = await User.exists({ studentNumber });
    if (!exists) return studentNumber;
  }
  return `HA-${year}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
}

export function splitStudentName(body: Record<string, unknown>) {
  const firstName = trim(body.firstName);
  const lastName = trim(body.lastName);
  const fullName = trim(body.name) || [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    firstName: firstName || fullName.split(/\s+/)[0] || "",
    lastName: lastName || fullName.split(/\s+/).slice(1).join(" "),
    name: fullName,
  };
}

export function studentUpdateFields(body: Record<string, unknown>) {
  const names = splitStudentName(body);
  const status = normalizeStudentStatus(body.status, body.isActive === false ? "suspended" : "active");
  const updates: Record<string, unknown> = {
    ...names,
    status,
    isActive: statusToIsActive(status),
  };
  const fields = [
    "email",
    "phone",
    "secondaryPhone",
    "gender",
    "placeOfBirth",
    "nationality",
    "profilePhotoUrl",
    "guardianName",
    "guardianPhone",
    "guardianRelationship",
    "address",
    "wilaya",
    "commune",
    "municipality",
    "academicSeason",
    "academicLevel",
    "grade",
    "specialization",
    "className",
    "groupName",
    "enrollmentType",
    "previousSchool",
    "previousResults",
    "studyLevel",
    "institution",
    "medicalNotes",
    "notes",
  ];
  for (const field of fields) {
    if (body[field] !== undefined) updates[field] = trim(body[field]);
  }
  if (body.dateOfBirth !== undefined) updates.dateOfBirth = validDate(body.dateOfBirth);
  if (body.registrationDate !== undefined) updates.registrationDate = validDate(body.registrationDate) ?? new Date();
  if (body.enrollmentStartDate !== undefined) updates.enrollmentStartDate = validDate(body.enrollmentStartDate);
  if (body.enrollmentEndDate !== undefined) updates.enrollmentEndDate = validDate(body.enrollmentEndDate);
  if (body.isRepeating !== undefined) updates.isRepeating = body.isRepeating === true;
  if (!updates.academicLevel && updates.studyLevel) updates.academicLevel = updates.studyLevel;
  if (!updates.studyLevel && updates.academicLevel) updates.studyLevel = updates.academicLevel;
  if (body.gender !== undefined && body.gender !== "male" && body.gender !== "female") updates.gender = undefined;
  return updates;
}

export async function upsertGuardians(studentId: string, guardians: unknown, userId: string) {
  if (!Array.isArray(guardians)) return [];
  const sid = objectId(studentId);
  if (!sid) throw new Error("Invalid student id");
  const linked = [];
  for (const raw of guardians) {
    const item = raw as Record<string, unknown>;
    const fullName = trim(item.fullName || item.name);
    const primaryPhone = trim(item.primaryPhone || item.phone);
    const relationship = trim(item.relationship) || "guardian";
    if (!fullName || !primaryPhone) continue;
    const guardian = await Guardian.findOneAndUpdate(
      { fullName, primaryPhone },
      {
        fullName,
        primaryPhone,
        relationship,
        secondaryPhone: trim(item.secondaryPhone),
        email: trim(item.email),
        address: trim(item.address),
        occupation: trim(item.occupation),
        workplace: trim(item.workplace),
        notes: trim(item.notes),
        updatedBy: userId,
        $addToSet: { studentIds: sid },
        $setOnInsert: { createdBy: userId },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    const link = await StudentGuardianLink.findOneAndUpdate(
      { studentId: sid, guardianId: guardian._id },
      {
        relationship,
        isPrimary: item.isPrimary === true,
        financiallyResponsible: item.financiallyResponsible === true,
        authorizedPickup: item.authorizedPickup === true,
        notes: trim(item.notes),
        updatedBy: userId,
        $setOnInsert: { createdBy: userId },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    linked.push({ guardian, link });
  }
  const hasPrimary = await StudentGuardianLink.exists({ studentId: sid, isPrimary: true });
  if (!hasPrimary) {
    const first = await StudentGuardianLink.findOne({ studentId: sid }).sort({ createdAt: 1 });
    if (first) {
      first.isPrimary = true;
      await first.save();
    }
  }
  await recordAudit({ userId, action: "student.guardians.upsert", recordType: "student", recordId: studentId, metadata: { count: linked.length } });
  return linked;
}

export async function getStudentGuardians(studentId: string) {
  const sid = objectId(studentId);
  if (!sid) return [];
  const links = await StudentGuardianLink.find({ studentId: sid }).populate("guardianId").sort({ isPrimary: -1, createdAt: 1 }).lean();
  return links.map((link) => {
    const guardian = link.guardianId as unknown as Record<string, unknown>;
    return {
      _id: guardian._id?.toString?.() ?? link.guardianId.toString(),
      linkId: link._id.toString(),
      fullName: guardian.fullName,
      relationship: link.relationship || guardian.relationship,
      primaryPhone: guardian.primaryPhone,
      secondaryPhone: guardian.secondaryPhone ?? "",
      email: guardian.email ?? "",
      address: guardian.address ?? "",
      occupation: guardian.occupation ?? "",
      workplace: guardian.workplace ?? "",
      isPrimary: link.isPrimary,
      financiallyResponsible: link.financiallyResponsible,
      authorizedPickup: link.authorizedPickup,
      notes: link.notes ?? guardian.notes ?? "",
    };
  });
}

export async function enrichStudentRecord(student: Parameters<typeof formatStudent>[0]) {
  const studentId = student._id.toString();
  const oid = new mongoose.Types.ObjectId(studentId);
  const [enrollments, legacyPayments, charges, payments, guardians, attendanceSummary, latestPerformance] = await Promise.all([
    Enrollment.find({ student: oid }).populate("course", "title price level teacher").sort({ createdAt: -1 }).lean(),
    Payment.aggregate([{ $match: { studentId: oid } }, { $group: { _id: "$studentId", totalPaid: { $sum: "$amount" } } }]),
    StudentCharge.find({ studentId: oid, status: { $ne: "cancelled" } }).lean(),
    StudentPayment.find({ studentId: oid }).sort({ paymentDate: -1 }).limit(5).lean(),
    getStudentGuardians(studentId),
    StudentAttendance.aggregate([
      { $match: { studentId: oid } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    StudentPerformance.find({ studentId: oid }).sort({ createdAt: -1 }).limit(1).lean(),
  ]);
  const courses = enrollments.map((enrollment) => {
    const course = enrollment.course as { _id?: { toString(): string }; title?: string; price?: number; level?: string } | null;
    return course?._id ? {
      _id: course._id.toString(),
      title: course.title ?? "",
      price: course.price ?? 0,
      level: course.level ?? "",
      enrollmentStatus: enrollment.status,
      note: enrollment.note ?? "",
      enrolledAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    } : null;
  }).filter(Boolean);
  const legacyTotal = courses.reduce((sum, course) => sum + (["pending", "approved", "accepted"].includes(String(course?.enrollmentStatus)) ? Number(course?.price ?? 0) : 0), 0);
  const financeTotal = charges.reduce((sum, charge) => sum + charge.finalAmountMinor, 0);
  const financePaid = charges.reduce((sum, charge) => sum + charge.paidAmountMinor, 0);
  const legacyPaid = Number(legacyPayments[0]?.totalPaid) || 0;
  const totalAmount = financeTotal ? minorToAmount(financeTotal) : legacyTotal;
  const paidAmount = financeTotal ? minorToAmount(financePaid) : legacyPaid;
  const balance = Math.max(0, totalAmount - paidAmount);
  const paymentStatus = totalAmount > 0 && paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
  const present = attendanceSummary.find((row) => row._id === "present")?.count ?? 0;
  const totalAttendance = attendanceSummary.reduce((sum, row) => sum + row.count, 0);
  return {
    ...formatStudent(student),
    guardians,
    courses,
    enrollmentHistory: courses,
    course: courses.find((course) => ["pending", "approved", "accepted"].includes(String(course?.enrollmentStatus))) ?? courses[0] ?? null,
    totalAmount,
    paidAmount,
    balance,
    paymentStatus,
    recentPayments: payments.map((payment) => ({
      _id: payment._id.toString(),
      amount: minorToAmount(payment.amountMinor),
      receiptNumber: payment.receiptNumber,
      paymentMethod: payment.paymentMethod,
      paymentDate: toIso(payment.paymentDate),
    })),
    attendancePercentage: totalAttendance ? Math.round((present / totalAttendance) * 100) : 0,
    latestAcademicAverage: latestPerformance[0] ? Math.round((latestPerformance[0].score / latestPerformance[0].maxScore) * 100) : null,
  };
}

export async function listStudentRelatedRecords(studentId: string) {
  const oid = objectId(studentId);
  if (!oid) throw new Error("Invalid student id");
  const [attendance, performance, behavior, communications, notes] = await Promise.all([
    StudentAttendance.find({ studentId: oid }).sort({ date: -1 }).limit(100).lean(),
    StudentPerformance.find({ studentId: oid }).sort({ createdAt: -1 }).limit(100).lean(),
    StudentBehavior.find({ studentId: oid }).sort({ occurredAt: -1 }).limit(100).lean(),
    StudentCommunication.find({ studentId: oid }).sort({ createdAt: -1 }).limit(100).lean(),
    StudentNote.find({ studentId: oid }).sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  return {
    attendance,
    performance,
    behavior,
    communications,
    notes,
  };
}

export async function createStudentAttendance(body: Record<string, unknown>, userId: string) {
  const studentId = objectId(body.studentId);
  const actorId = objectId(userId);
  if (!studentId) throw new Error("Valid student is required");
  if (!actorId) throw new Error("Valid user is required");
  const date = validDate(body.date) ?? new Date();
  const status = trim(body.status) as IStudentAttendance["status"];
  if (!["present", "absent", "late", "excused", "left_early", "cancelled"].includes(status)) throw new Error("Invalid attendance status");
  const contextTypeRaw = trim(body.contextType) || "other";
  const contextType = (["class", "course", "support_lesson", "private_lesson", "kindergarten", "other"].includes(contextTypeRaw) ? contextTypeRaw : "other") as IStudentAttendance["contextType"];
  const record = await StudentAttendance.create({
    studentId,
    contextType,
    contextId: objectId(body.contextId) ?? undefined,
    courseId: objectId(body.courseId) ?? undefined,
    teacherId: objectId(body.teacherId) ?? undefined,
    academicSeason: trim(body.academicSeason),
    academicLevel: trim(body.academicLevel),
    className: trim(body.className),
    date,
    status,
    excuseReason: trim(body.excuseReason),
    notes: trim(body.notes),
    recordedBy: actorId,
    correctionHistory: [],
  } as Partial<IStudentAttendance>);
  await recordAudit({ userId, action: "student.attendance.create", recordType: "student_attendance", recordId: record._id.toString(), metadata: { studentId: studentId.toString(), status } });
  return record;
}

export async function createStudentPerformance(body: Record<string, unknown>, userId: string) {
  const studentId = objectId(body.studentId);
  const actorId = objectId(userId);
  if (!studentId) throw new Error("Valid student is required");
  if (!actorId) throw new Error("Valid user is required");
  const score = Number(body.score);
  const maxScore = Number(body.maxScore || 20);
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || score < 0 || maxScore <= 0 || score > maxScore) throw new Error("Invalid score");
  const typeRaw = trim(body.type) || "test";
  const type = (["test", "exam", "homework", "participation", "project", "teacher_evaluation"].includes(typeRaw) ? typeRaw : "test") as IStudentPerformance["type"];
  const record = await StudentPerformance.create({
    studentId,
    subject: trim(body.subject),
    academicSeason: trim(body.academicSeason),
    academicPeriod: trim(body.academicPeriod),
    teacherId: objectId(body.teacherId) ?? undefined,
    type,
    score,
    maxScore,
    average: Math.round((score / maxScore) * 100),
    rank: body.rank ? Number(body.rank) : undefined,
    remarks: trim(body.remarks),
    strengths: trim(body.strengths),
    weaknesses: trim(body.weaknesses),
    recommendations: trim(body.recommendations),
    createdBy: actorId,
    changeHistory: [],
  } as Partial<IStudentPerformance>);
  await recordAudit({ userId, action: "student.performance.create", recordType: "student_performance", recordId: record._id.toString(), metadata: { studentId: studentId.toString(), score, maxScore } });
  return record;
}

export async function createStudentBehavior(body: Record<string, unknown>, userId: string) {
  const studentId = objectId(body.studentId);
  const actorId = objectId(userId);
  if (!studentId) throw new Error("Valid student is required");
  if (!actorId) throw new Error("Valid user is required");
  const typeRaw = trim(body.type) || "follow_up";
  const type = (["positive", "warning", "incident", "violation", "disciplinary_action", "suspension", "guardian_meeting", "follow_up"].includes(typeRaw) ? typeRaw : "follow_up") as IStudentBehavior["type"];
  const resolutionRaw = trim(body.resolutionStatus) || "open";
  const resolutionStatus = (["open", "in_progress", "resolved", "archived"].includes(resolutionRaw) ? resolutionRaw : "open") as IStudentBehavior["resolutionStatus"];
  const record = await StudentBehavior.create({
    studentId,
    type,
    title: trim(body.title),
    description: trim(body.description),
    actionTaken: trim(body.actionTaken),
    resolutionStatus,
    attachments: Array.isArray(body.attachments) ? body.attachments.map(String) : [],
    recordedBy: actorId,
    occurredAt: validDate(body.occurredAt) ?? new Date(),
    notes: trim(body.notes),
  } as Partial<IStudentBehavior>);
  await recordAudit({ userId, action: "student.behavior.create", recordType: "student_behavior", recordId: record._id.toString(), metadata: { studentId: studentId.toString(), type: record.type } });
  return record;
}

export async function createStudentCommunication(body: Record<string, unknown>, userId: string) {
  const studentId = objectId(body.studentId);
  const actorId = objectId(userId);
  if (!studentId) throw new Error("Valid student is required");
  if (!actorId) throw new Error("Valid user is required");
  const typeRaw = trim(body.type) || "administrative_notice";
  const type = (["internal_notification", "sms", "email", "whatsapp", "phone_call", "guardian_meeting", "administrative_notice"].includes(typeRaw) ? typeRaw : "administrative_notice") as IStudentCommunication["type"];
  const relatedTypeRaw = trim(body.relatedType);
  const relatedType = (["attendance", "payment", "enrollment", "general"].includes(relatedTypeRaw) ? relatedTypeRaw : undefined) as IStudentCommunication["relatedType"];
  const record = await StudentCommunication.create({
    studentId,
    type,
    subject: trim(body.subject),
    content: trim(body.content),
    recipient: trim(body.recipient),
    relatedType,
    relatedId: objectId(body.relatedId) ?? undefined,
    deliveryStatus: trim(body.deliveryStatus),
    notes: trim(body.notes),
    recordedBy: actorId,
  } as Partial<IStudentCommunication>);
  await recordAudit({ userId, action: "student.communication.create", recordType: "student_communication", recordId: record._id.toString(), metadata: { studentId: studentId.toString(), type: record.type } });
  return record;
}

export async function createStudentNote(body: Record<string, unknown>, userId: string) {
  const studentId = objectId(body.studentId);
  const actorId = objectId(userId);
  if (!studentId) throw new Error("Valid student is required");
  if (!actorId) throw new Error("Valid user is required");
  const categoryRaw = trim(body.category) || "general";
  const category = (["academic", "administrative", "financial", "medical", "behavioral", "guardian", "general"].includes(categoryRaw) ? categoryRaw : "general") as IStudentNote["category"];
  const visibilityRaw = trim(body.visibility) || "internal";
  const visibility = (["internal", "staff", "guardian", "student"].includes(visibilityRaw) ? visibilityRaw : "internal") as IStudentNote["visibility"];
  const record = await StudentNote.create({
    studentId,
    category,
    note: trim(body.note),
    visibility,
    author: actorId,
    editHistory: [],
  } as Partial<IStudentNote>);
  await recordAudit({ userId, action: "student.note.create", recordType: "student_note", recordId: record._id.toString(), metadata: { studentId: studentId.toString(), category: record.category } });
  return record;
}

export async function executeStudentRollover(body: Record<string, unknown>, userId: string) {
  const sourceSeason = trim(body.sourceSeason);
  const targetSeason = trim(body.targetSeason);
  if (!sourceSeason || !targetSeason || sourceSeason === targetSeason) throw new Error("Valid source and target seasons are required");
  const action = trim(body.action) || "promote";
  const students = await User.find({ role: "student", academicSeason: sourceSeason, deletedAt: null });
  const changes = [];
  for (const student of students) {
    const previous = { status: student.status, academicSeason: student.academicSeason, academicLevel: student.academicLevel };
    student.academicSeason = targetSeason;
    if (action === "graduate") student.status = "graduated";
    if (action === "withdraw") student.status = "withdrawn";
    if (action === "archive") {
      student.status = "archived";
      student.deletedAt = new Date();
    }
    student.isActive = statusToIsActive(student.status);
    await student.save();
    changes.push({ studentId: student._id.toString(), previous, next: { status: student.status, academicSeason: student.academicSeason, academicLevel: student.academicLevel } });
  }
  const audit = await StudentRolloverAudit.create({ sourceSeason, targetSeason, changes, executedBy: userId });
  await recordAudit({ userId, action: "student.rollover", recordType: "student_rollover", recordId: audit._id.toString(), metadata: { sourceSeason, targetSeason, action, count: changes.length } });
  return { _id: audit._id.toString(), count: changes.length, changes };
}
