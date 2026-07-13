import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import { connectDB } from "@/lib/db";
import { minorToAmount } from "@/lib/student-finance";
import { receiptPdf } from "@/lib/receipt-documents";
import User from "@/models/User";
import Enrollment from "@/models/Enrollment";
import Course from "@/models/Course";
import Teacher from "@/models/Teacher";
import Notification from "@/models/Notification";
import KindergartenRegistration from "@/models/Kindergarten";
import TransportSubscription from "@/models/TransportSubscription";
import { PrivateLesson } from "@/models/PrivateLesson";
import { StudentCharge, StudentDiscount, StudentPayment, StudentRefund } from "@/models/StudentFinance";
import {
  Guardian,
  StudentAttendance,
  StudentCommunication,
  StudentGuardianLink,
  StudentNote,
  StudentPerformance,
} from "@/models/StudentRecords";

type Plain = Record<string, unknown>;

export class ParentPortalError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function idOf(value: unknown) {
  if (!value) return "";
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object" && value !== null && "_id" in value) return idOf((value as Plain)._id);
  return String(value);
}

function asDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizePhone(value?: string | null) {
  return String(value ?? "").replace(/[^\d+]/g, "");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pickStudentId(searchParams?: URLSearchParams) {
  const raw = searchParams?.get("studentId");
  return raw && Types.ObjectId.isValid(raw) ? raw : "";
}

function dateFilter(searchParams?: URLSearchParams) {
  const range: Plain = {};
  const from = searchParams?.get("from");
  const to = searchParams?.get("to");
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return Object.keys(range).length ? range : undefined;
}

async function requireParentPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user || user.role !== "parent" || !hasPermission(user.role, permission)) {
    throw new ParentPortalError("غير مصرح بالوصول إلى بوابة الأولياء", 403);
  }
  return user;
}

export async function getParentContext(permission: Permission, searchParams?: URLSearchParams) {
  const user = await requireParentPermission(permission);
  await connectDB();

  const phone = normalizePhone(user.phone);
  const rawContactFilters: Plain[] = [];
  if (user.email) rawContactFilters.push({ email: user.email.toLowerCase() });
  if (phone) rawContactFilters.push({ primaryPhone: user.phone }, { secondaryPhone: user.phone });

  const guardians = rawContactFilters.length ? await Guardian.find({ $or: rawContactFilters }).lean<Plain[]>() : [];
  const guardianIds = guardians.map((guardian) => idOf(guardian._id)).filter(Boolean);
  const linkRows = guardianIds.length
    ? await StudentGuardianLink.find({ guardianId: { $in: guardianIds } }).lean<Plain[]>()
    : [];

  const linkedIds = new Set<string>();
  guardians.forEach((guardian) => {
    const studentIds = Array.isArray(guardian.studentIds) ? guardian.studentIds : [];
    studentIds.forEach((studentId) => linkedIds.add(idOf(studentId)));
  });
  linkRows.forEach((link) => linkedIds.add(idOf(link.studentId)));

  if (phone) {
    const fallbackStudents = await User.find({ role: "student", deletedAt: null, guardianPhone: user.phone })
      .select("_id")
      .lean<Plain[]>();
    fallbackStudents.forEach((student) => linkedIds.add(idOf(student._id)));
  }

  const requestedStudentId = pickStudentId(searchParams);
  const ownedIds = Array.from(linkedIds).filter((studentId) => Types.ObjectId.isValid(studentId));
  const scopedIds = requestedStudentId ? ownedIds.filter((studentId) => studentId === requestedStudentId) : ownedIds;

  if (requestedStudentId && scopedIds.length === 0) {
    throw new ParentPortalError("لا يمكن الوصول إلى بيانات هذا الطالب", 403);
  }

  const objectIds = scopedIds.map((studentId) => new Types.ObjectId(studentId));
  const children = objectIds.length
    ? await User.find({ _id: { $in: objectIds }, role: "student", deletedAt: null })
        .select("-password")
        .lean<Plain[]>()
    : [];

  return { user, children, childIds: children.map((child) => new Types.ObjectId(idOf(child._id))) };
}

function studentSummary(student: Plain) {
  return {
    id: idOf(student._id),
    studentNumber: student.studentNumber ?? "",
    name: student.name ?? "",
    status: student.status ?? "",
    academicSeason: student.academicSeason ?? "",
    academicLevel: student.academicLevel ?? student.studyLevel ?? "",
    className: student.className ?? "",
    groupName: student.groupName ?? "",
    enrollmentType: student.enrollmentType ?? "",
    registrationDate: asDate(student.registrationDate),
    guardianName: student.guardianName ?? "",
    guardianRelationship: student.guardianRelationship ?? "",
    medicalNotes: student.medicalNotes ?? "",
    profilePhotoUrl: student.profilePhotoUrl ?? "",
  };
}

async function getOwnedEnrollments(childIds: Types.ObjectId[]) {
  if (!childIds.length) return [];
  return Enrollment.find({ student: { $in: childIds } })
    .populate({ path: "course", model: Course, select: "title level teacher startDate endDate studyDays startTime endTime room" })
    .lean<Plain[]>();
}

async function getRecentNotifications(parentId: string, limit = 8) {
  return Notification.find({
    $or: [{ userId: new Types.ObjectId(parentId) }, { audienceRoles: "parent" }],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Plain[]>()
    .then((items) =>
      items.map((item) => ({
        id: idOf(item._id),
        title: item.title ?? "",
        message: item.message ?? "",
        type: item.type ?? "info",
        domain: item.domain ?? "system",
        read: Array.isArray(item.readBy) && item.readBy.some((reader) => idOf(reader) === parentId),
        createdAt: asDate(item.createdAt),
      }))
    );
}

export async function getParentDashboardData() {
  const { user, children, childIds } = await getParentContext("parent.dashboard.view");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [attendanceAgg, attendanceToday, recentGrades, charges, payments, enrollments, notifications] = await Promise.all([
    StudentAttendance.aggregate([
      { $match: { studentId: { $in: childIds } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    StudentAttendance.find({ studentId: { $in: childIds }, date: { $gte: todayStart, $lt: todayEnd } }).lean<Plain[]>(),
    StudentPerformance.find({ studentId: { $in: childIds } }).sort({ createdAt: -1 }).limit(6).lean<Plain[]>(),
    StudentCharge.find({ studentId: { $in: childIds } }).lean<Plain[]>(),
    StudentPayment.find({ studentId: { $in: childIds } }).sort({ paymentDate: -1, createdAt: -1 }).limit(6).lean<Plain[]>(),
    getOwnedEnrollments(childIds),
    getRecentNotifications(idOf(user._id)),
  ]);

  const attendanceTotal = attendanceAgg.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const presentTotal = attendanceAgg
    .filter((row) => ["present", "late", "excused"].includes(String(row._id)))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const outstandingMinor = charges.reduce((sum, charge) => sum + Number(charge.balanceMinor || 0), 0);

  return {
    children: children.map(studentSummary),
    cards: {
      linkedChildren: children.length,
      attendanceToday: attendanceToday.length,
      attendancePercentage: attendanceTotal ? Math.round((presentTotal / attendanceTotal) * 100) : 0,
      upcomingClasses: enrollments.filter((enrollment) => idOf(enrollment.course)).slice(0, 5).length,
      upcomingExams: recentGrades.filter((grade) => grade.type === "exam").length,
      recentGrades: recentGrades.length,
      outstandingBalance: minorToAmount(outstandingMinor),
      recentPayments: payments.length,
      recentNotifications: notifications.length,
    },
    attendanceToday: attendanceToday.map((row) => ({ id: idOf(row._id), studentId: idOf(row.studentId), status: row.status, date: asDate(row.date), className: row.className ?? "" })),
    recentGrades: recentGrades.map((row) => ({
      id: idOf(row._id),
      studentId: idOf(row.studentId),
      subject: row.subject ?? "",
      type: row.type ?? "",
      score: row.score ?? 0,
      maxScore: row.maxScore ?? 0,
      percentage: row.maxScore ? Math.round((Number(row.score || 0) / Number(row.maxScore)) * 100) : 0,
      remarks: row.remarks ?? "",
      createdAt: asDate(row.createdAt),
    })),
    recentPayments: payments.map((payment) => ({
      id: idOf(payment._id),
      amount: minorToAmount(payment.amountMinor),
      paymentMethod: payment.paymentMethod ?? "",
      paymentDate: asDate(payment.paymentDate),
      receiptNumber: payment.receiptNumber ?? "",
    })),
    notifications,
  };
}

export async function getParentChildren() {
  const { children, childIds } = await getParentContext("parent.students.view");
  const enrollments = await getOwnedEnrollments(childIds);
  const teacherIds = Array.from(
    new Set(enrollments.flatMap((enrollment) => [idOf((enrollment.course as Plain | undefined)?.teacher), ...(Array.isArray(enrollment.teachers) ? enrollment.teachers.map(idOf) : [])]).filter(Boolean))
  );
  const teachers = teacherIds.length ? await Teacher.find({ _id: { $in: teacherIds } }).select("name subject subjects assignedClasses").lean<Plain[]>() : [];
  const teacherMap = new Map(teachers.map((teacher) => [idOf(teacher._id), teacher]));

  return {
    children: children.map((child) => ({
      ...studentSummary(child),
      assignedTeachers: enrollments
        .filter((enrollment) => idOf(enrollment.student) === idOf(child._id))
        .flatMap((enrollment) => [idOf((enrollment.course as Plain | undefined)?.teacher), ...(Array.isArray(enrollment.teachers) ? enrollment.teachers.map(idOf) : [])])
        .filter(Boolean)
        .map((teacherId) => teacherMap.get(teacherId))
        .filter(Boolean)
        .map((teacher) => ({ id: idOf(teacher?._id), name: teacher?.name ?? "", subject: teacher?.subject ?? "" })),
    })),
  };
}

export async function getParentAttendance(searchParams?: URLSearchParams) {
  const { childIds } = await getParentContext("parent.attendance.view", searchParams);
  const match: Plain = { studentId: { $in: childIds } };
  const range = dateFilter(searchParams);
  if (range) match.date = range;

  const [records, summary] = await Promise.all([
    StudentAttendance.find(match).sort({ date: -1 }).limit(200).lean<Plain[]>(),
    StudentAttendance.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const total = summary.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const count = (status: string) => summary.find((row) => row._id === status)?.count ?? 0;

  return {
    summary: {
      total,
      present: count("present"),
      absent: count("absent"),
      late: count("late"),
      excused: count("excused"),
      attendancePercentage: total ? Math.round((Number(count("present")) / total) * 100) : 0,
    },
    records: records.map((row) => ({
      id: idOf(row._id),
      studentId: idOf(row.studentId),
      date: asDate(row.date),
      status: row.status ?? "",
      contextType: row.contextType ?? "",
      className: row.className ?? "",
      academicLevel: row.academicLevel ?? "",
      excuseReason: row.excuseReason ?? "",
      notes: row.notes ?? "",
    })),
  };
}

export async function getParentPerformance(searchParams?: URLSearchParams) {
  const { childIds } = await getParentContext("parent.reports.view", searchParams);
  const records = await StudentPerformance.find({ studentId: { $in: childIds } }).sort({ createdAt: -1 }).limit(200).lean<Plain[]>();
  const byType = await StudentPerformance.aggregate([
    { $match: { studentId: { $in: childIds } } },
    { $group: { _id: "$type", score: { $sum: "$score" }, maxScore: { $sum: "$maxScore" }, count: { $sum: 1 } } },
  ]);

  return {
    summary: byType.map((row) => ({
      type: row._id,
      count: row.count,
      average: row.maxScore ? Math.round((Number(row.score) / Number(row.maxScore)) * 100) : 0,
    })),
    records: records.map((row) => ({
      id: idOf(row._id),
      studentId: idOf(row.studentId),
      subject: row.subject ?? "",
      type: row.type ?? "",
      score: row.score ?? 0,
      maxScore: row.maxScore ?? 0,
      average: row.average ?? null,
      percentage: row.maxScore ? Math.round((Number(row.score || 0) / Number(row.maxScore)) * 100) : 0,
      remarks: row.remarks ?? "",
      strengths: row.strengths ?? "",
      weaknesses: row.weaknesses ?? "",
      recommendations: row.recommendations ?? "",
      createdAt: asDate(row.createdAt),
    })),
  };
}

export async function getParentFinance(searchParams?: URLSearchParams) {
  const { childIds } = await getParentContext("parent.finance.view", searchParams);
  const [charges, payments, discounts, refunds] = await Promise.all([
    StudentCharge.find({ studentId: { $in: childIds } }).sort({ dueDate: -1, createdAt: -1 }).limit(200).lean<Plain[]>(),
    StudentPayment.find({ studentId: { $in: childIds } }).sort({ paymentDate: -1, createdAt: -1 }).limit(100).lean<Plain[]>(),
    StudentDiscount.find({ studentId: { $in: childIds } }).sort({ createdAt: -1 }).limit(100).lean<Plain[]>(),
    StudentRefund.find({ studentId: { $in: childIds } }).sort({ refundDate: -1, createdAt: -1 }).limit(100).lean<Plain[]>(),
  ]);

  const totalDueMinor = charges.reduce((sum, charge) => sum + Number(charge.finalAmountMinor || 0), 0);
  const totalPaidMinor = payments.reduce((sum, payment) => sum + Number(payment.amountMinor || 0), 0);
  const outstandingMinor = charges.reduce((sum, charge) => sum + Number(charge.balanceMinor || 0), 0);

  return {
    summary: {
      registrationFees: minorToAmount(charges.filter((charge) => charge.chargeType === "registration").reduce((sum, charge) => sum + Number(charge.finalAmountMinor || 0), 0)),
      monthlyFees: minorToAmount(charges.filter((charge) => ["monthly", "course", "tuition"].includes(String(charge.chargeType))).reduce((sum, charge) => sum + Number(charge.finalAmountMinor || 0), 0)),
      privateLessons: minorToAmount(charges.filter((charge) => charge.chargeType === "private_lesson").reduce((sum, charge) => sum + Number(charge.finalAmountMinor || 0), 0)),
      kindergarten: minorToAmount(charges.filter((charge) => charge.chargeType === "kindergarten").reduce((sum, charge) => sum + Number(charge.finalAmountMinor || 0), 0)),
      transportation: minorToAmount(charges.filter((charge) => charge.chargeType === "transportation").reduce((sum, charge) => sum + Number(charge.finalAmountMinor || 0), 0)),
      discounts: minorToAmount(discounts.reduce((sum, discount) => sum + Number(discount.appliedAmountMinor || 0), 0)),
      totalDue: minorToAmount(totalDueMinor),
      totalPaid: minorToAmount(totalPaidMinor),
      outstandingBalance: minorToAmount(outstandingMinor),
      refunds: minorToAmount(refunds.reduce((sum, refund) => sum + Number(refund.refundAmountMinor || 0), 0)),
    },
    charges: charges.map((charge) => ({ id: idOf(charge._id), type: charge.chargeType, status: charge.status, amount: minorToAmount(charge.finalAmountMinor), paid: minorToAmount(charge.paidAmountMinor), balance: minorToAmount(charge.balanceMinor), dueDate: asDate(charge.dueDate), description: charge.description ?? "" })),
    payments: payments.map((payment) => ({ id: idOf(payment._id), amount: minorToAmount(payment.amountMinor), paymentDate: asDate(payment.paymentDate), paymentMethod: payment.paymentMethod, receiptNumber: payment.receiptNumber ?? "" })),
    discounts: discounts.map((discount) => ({ id: idOf(discount._id), type: discount.discountType, amount: minorToAmount(discount.appliedAmountMinor), reason: discount.reason ?? "", createdAt: asDate(discount.createdAt) })),
    refunds: refunds.map((refund) => ({ id: idOf(refund._id), amount: minorToAmount(refund.refundAmountMinor), reason: refund.reason ?? "", refundDate: asDate(refund.refundDate) })),
  };
}

export async function getParentPrivateLessons(searchParams?: URLSearchParams) {
  const { childIds } = await getParentContext("parent.students.view", searchParams);
  const lessons = await PrivateLesson.find({ "students.studentId": { $in: childIds }, deletedAt: null })
    .populate({ path: "teacherId", model: Teacher, select: "name subject phone" })
    .sort({ startAt: -1 })
    .limit(100)
    .lean<Plain[]>();

  return {
    lessons: lessons.map((lesson) => ({
      id: idOf(lesson._id),
      subject: lesson.subject ?? "",
      teacher: (lesson.teacherId as Plain | undefined)?.name ?? "",
      date: asDate(lesson.lessonDate ?? lesson.startAt),
      startTime: lesson.startTime ?? "",
      endTime: lesson.endTime ?? "",
      status: lesson.status ?? "",
      attendance: lesson.studentAttendanceStatus ?? "",
      paymentStatus: lesson.paymentStatus ?? "",
      amount: minorToAmount((lesson.pricing as Plain | undefined)?.finalAmountMinor),
      receipts: Array.isArray(lesson.students) ? lesson.students.map((student) => ({ studentId: idOf((student as Plain).studentId), chargeId: idOf((student as Plain).chargeId) })) : [],
    })),
  };
}

export async function getParentKindergarten(searchParams?: URLSearchParams) {
  const { user, childIds } = await getParentContext("parent.students.view", searchParams);
  const phone = normalizePhone(user.phone);
  const records = await KindergartenRegistration.find({
    deletedAt: null,
    $or: [{ childId: { $in: childIds } }, ...(phone ? [{ guardianPhone: user.phone }] : [])],
  })
    .populate({ path: "teacherId", model: Teacher, select: "name subject" })
    .sort({ registrationDate: -1 })
    .limit(100)
    .lean<Plain[]>();

  return {
    registrations: records.map((record) => ({
      id: idOf(record._id),
      childName: record.childName ?? "",
      teacher: (record.teacherId as Plain | undefined)?.name ?? "",
      groupName: record.groupName ?? "",
      schedule: record.attendanceSchedule ?? "",
      subscriptionType: record.subscriptionType ?? "",
      status: record.status ?? "",
      registrationRemaining: minorToAmount(record.registrationRemainingMinor),
      subscriptionRemaining: minorToAmount(record.subscriptionRemainingMinor),
      totalOutstanding: minorToAmount(record.totalOutstandingMinor),
      payments: Array.isArray(record.payments)
        ? record.payments.map((payment) => ({ id: idOf((payment as Plain)._id), type: (payment as Plain).paymentType, amount: minorToAmount((payment as Plain).amountMinor), receiptNumber: (payment as Plain).receiptNumber ?? "", paymentDate: asDate((payment as Plain).paymentDate) }))
        : [],
    })),
  };
}

export async function getParentTransportation(searchParams?: URLSearchParams) {
  const { childIds } = await getParentContext("parent.students.view", searchParams);
  const records = await TransportSubscription.find({ studentId: { $in: childIds } })
    .populate({ path: "busId", populate: [{ path: "routeId" }, { path: "driverId" }] })
    .sort({ startDate: -1 })
    .limit(100)
    .lean<Plain[]>();

  return {
    subscriptions: records.map((record) => {
      const bus = record.busId as Plain | undefined;
      return {
        id: idOf(record._id),
        studentId: idOf(record.studentId),
        status: record.status ?? "",
        pickupPoint: record.pickupPoint ?? "",
        dropoffPoint: record.dropoffPoint ?? "",
        startDate: asDate(record.startDate),
        endDate: asDate(record.endDate),
        bus: bus?.plateNumber ?? bus?.name ?? "",
        route: (bus?.routeId as Plain | undefined)?.name ?? (bus?.routeId as Plain | undefined)?.title ?? "",
        driver: (bus?.driverId as Plain | undefined)?.name ?? "",
        notes: record.notes ?? "",
      };
    }),
  };
}

export async function getParentDocuments(searchParams?: URLSearchParams) {
  const { children } = await getParentContext("parent.documents.view", searchParams);
  return {
    documents: children.flatMap((child) =>
      (Array.isArray(child.documents) ? child.documents : []).map((document) => ({
        studentId: idOf(child._id),
        studentName: child.name ?? "",
        title: (document as Plain).title ?? "",
        type: (document as Plain).type ?? "other",
        url: (document as Plain).url ?? "",
        uploadedAt: asDate((document as Plain).uploadedAt),
        verificationStatus: (document as Plain).verificationStatus ?? "pending",
      }))
    ),
  };
}

export async function getParentCommunications(searchParams?: URLSearchParams) {
  const { user, childIds } = await getParentContext("parent.communications.view", searchParams);
  const [communications, notes, notifications] = await Promise.all([
    StudentCommunication.find({ studentId: { $in: childIds } }).sort({ createdAt: -1 }).limit(100).lean<Plain[]>(),
    StudentNote.find({ studentId: { $in: childIds }, visibility: { $in: ["guardian", "student"] } }).sort({ createdAt: -1 }).limit(100).lean<Plain[]>(),
    getRecentNotifications(idOf(user._id), 20),
  ]);

  return {
    communications: communications.map((item) => ({ id: idOf(item._id), studentId: idOf(item.studentId), channel: item.type, subject: item.subject, preview: String(item.content ?? "").slice(0, 160), recipient: item.recipient, status: item.deliveryStatus ?? "", createdAt: asDate(item.createdAt) })),
    notes: notes.map((note) => ({ id: idOf(note._id), studentId: idOf(note.studentId), category: note.category, note: note.note, createdAt: asDate(note.createdAt) })),
    notifications,
  };
}

export async function getParentReports(searchParams?: URLSearchParams) {
  const [attendance, performance, finance] = await Promise.all([
    getParentAttendance(searchParams),
    getParentPerformance(searchParams),
    getParentFinance(searchParams),
  ]);
  return {
    attendance: attendance.summary,
    academic: performance.summary,
    finance: finance.summary,
    generatedAt: new Date().toISOString(),
  };
}

export async function getParentPrintableReport(searchParams?: URLSearchParams) {
  const report = await getParentReports(searchParams);
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ولي الأمر</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111827}.header{border-bottom:2px solid #db2777;padding-bottom:16px;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #e5e7eb;border-radius:8px;padding:14px}h1{color:#be185d}button{display:none}@media print{body{margin:18mm}}</style></head><body><div class="header"><h1>تقرير بوابة ولي الأمر</h1><p>تاريخ التوليد: ${escapeHtml(report.generatedAt)}</p></div><div class="grid"><div class="card"><h2>الحضور</h2><p>النسبة: ${escapeHtml(report.attendance.attendancePercentage)}%</p><p>غياب: ${escapeHtml(report.attendance.absent)}</p><p>تأخر: ${escapeHtml(report.attendance.late)}</p></div><div class="card"><h2>المالية</h2><p>المستحق: ${escapeHtml(report.finance.totalDue)}</p><p>المدفوع: ${escapeHtml(report.finance.totalPaid)}</p><p>المتبقي: ${escapeHtml(report.finance.outstandingBalance)}</p></div><div class="card"><h2>الأداء</h2>${report.academic.map((item) => `<p>${escapeHtml(item.type)}: ${escapeHtml(item.average)}%</p>`).join("")}</div></div><script>window.print()</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function getParentPdfReport(searchParams?: URLSearchParams) {
  const report = await getParentReports(searchParams);
  const pdf = await receiptPdf({
    title: "تقرير بوابة ولي الأمر",
    receiptNumber: `PARENT-${Date.now()}`,
    fields: [
      { label: "تاريخ التوليد", value: new Date(report.generatedAt).toLocaleString("ar-DZ") },
      { label: "نسبة الحضور", value: `${report.attendance.attendancePercentage}%` },
      { label: "عدد الغيابات", value: report.attendance.absent },
      { label: "عدد التأخرات", value: report.attendance.late },
      { label: "إجمالي المستحق", value: report.finance.totalDue },
      { label: "إجمالي المدفوع", value: report.finance.totalPaid },
      { label: "الرصيد المتبقي", value: report.finance.outstandingBalance },
      { label: "عدد سجلات الأداء", value: report.academic.reduce((sum, item) => sum + Number(item.count || 0), 0) },
    ],
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "inline; filename=parent-report.pdf",
    },
  });
}
