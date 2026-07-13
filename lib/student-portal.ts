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
import { PrivateLesson, PrivateLessonNote, PrivateLessonPerformance } from "@/models/PrivateLesson";
import { StudentCharge, StudentDiscount, StudentPayment, StudentRefund } from "@/models/StudentFinance";
import { Guardian, StudentAttendance, StudentCommunication, StudentGuardianLink, StudentNote, StudentPerformance } from "@/models/StudentRecords";

type Plain = Record<string, unknown>;

export class StudentPortalError extends Error {
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function requireStudent(permission: Permission) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student" || !hasPermission(user.role, permission)) {
    throw new StudentPortalError("غير مصرح بالوصول إلى بوابة الطالب", 403);
  }
  await connectDB();
  const student = await User.findOne({ _id: user._id, role: "student", deletedAt: null }).select("-password").lean<Plain>();
  if (!student) throw new StudentPortalError("تعذر العثور على ملف الطالب", 404);
  return { user, student, studentId: new Types.ObjectId(user._id) };
}

function studentSummary(student: Plain) {
  return {
    id: idOf(student._id),
    studentNumber: student.studentNumber ?? "",
    name: student.name ?? "",
    firstName: student.firstName ?? "",
    lastName: student.lastName ?? "",
    status: student.status ?? "",
    gender: student.gender ?? "",
    dateOfBirth: asDate(student.dateOfBirth),
    phone: student.phone ?? "",
    secondaryPhone: student.secondaryPhone ?? "",
    email: student.email ?? "",
    address: student.address ?? "",
    wilaya: student.wilaya ?? "",
    commune: student.commune ?? "",
    academicSeason: student.academicSeason ?? "",
    academicLevel: student.academicLevel ?? student.studyLevel ?? "",
    grade: student.grade ?? "",
    className: student.className ?? "",
    groupName: student.groupName ?? "",
    enrollmentType: student.enrollmentType ?? "",
    registrationDate: asDate(student.registrationDate),
    guardianName: student.guardianName ?? "",
    guardianPhone: student.guardianPhone ?? "",
    guardianRelationship: student.guardianRelationship ?? "",
    medicalNotes: student.medicalNotes ?? "",
    profilePhotoUrl: student.profilePhotoUrl ?? "",
  };
}

async function getStudentEnrollments(studentId: Types.ObjectId) {
  return Enrollment.find({ student: studentId })
    .populate({ path: "course", model: Course, select: "title description level duration price teacher startDate endDate studyDays startTime endTime room isActive" })
    .populate({ path: "teachers", model: Teacher, select: "name subject subjects" })
    .sort({ createdAt: -1 })
    .lean<Plain[]>();
}

async function getStudentNotifications(studentId: Types.ObjectId, limit = 10) {
  return Notification.find({
    $or: [{ userId: studentId }, { audienceRoles: "student" }, { audienceRoles: { $size: 0 }, userId: { $exists: false } }],
    domain: { $in: ["student", "system", "transport", "finance"] },
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
        read: Array.isArray(item.readBy) && item.readBy.some((reader) => idOf(reader) === idOf(studentId)),
        createdAt: asDate(item.createdAt),
      }))
    );
}

function formatCourseEnrollment(enrollment: Plain) {
  const course = (enrollment.course as Plain | undefined) ?? {};
  const teacher = (course.teacher as Plain | undefined) ?? {};
  return {
    id: idOf(enrollment._id),
    status: enrollment.status ?? "",
    academicSeason: enrollment.academicSeason ?? "",
    academicLevel: enrollment.academicLevel ?? "",
    className: enrollment.className ?? "",
    subjects: Array.isArray(enrollment.subjects) ? enrollment.subjects : [],
    progress: enrollment.status === "completed" ? 100 : enrollment.status === "approved" || enrollment.status === "accepted" ? 60 : 0,
    course: {
      id: idOf(course._id),
      title: course.title ?? "",
      description: course.description ?? "",
      level: course.level ?? "",
      duration: course.duration ?? "",
      startDate: asDate(course.startDate),
      endDate: asDate(course.endDate),
      studyDays: course.studyDays ?? "",
      startTime: course.startTime ?? "",
      endTime: course.endTime ?? "",
      room: course.room ?? "",
      teacher: { id: idOf(teacher._id), name: teacher.name ?? "", subject: teacher.subject ?? "" },
    },
  };
}

export async function getStudentDashboardData() {
  const { studentId } = await requireStudent("student.dashboard.view");
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [enrollments, attendanceSummary, recentGrades, homework, privateLessons, notifications] = await Promise.all([
    getStudentEnrollments(studentId),
    StudentAttendance.aggregate([{ $match: { studentId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    StudentPerformance.find({ studentId }).sort({ createdAt: -1 }).limit(6).lean<Plain[]>(),
    StudentPerformance.find({ studentId, type: "homework" }).sort({ createdAt: -1 }).limit(5).lean<Plain[]>(),
    PrivateLesson.find({ "students.studentId": studentId, deletedAt: null }).populate({ path: "teacherId", model: Teacher, select: "name subject" }).sort({ startAt: -1 }).limit(8).lean<Plain[]>(),
    getStudentNotifications(studentId),
  ]);

  const totalAttendance = attendanceSummary.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const present = attendanceSummary.filter((row) => ["present", "late", "excused"].includes(String(row._id))).reduce((sum, row) => sum + Number(row.count || 0), 0);
  const gradeTotals = recentGrades.reduce<{ score: number; max: number }>((acc, grade) => ({ score: acc.score + Number(grade.score || 0), max: acc.max + Number(grade.maxScore || 0) }), { score: 0, max: 0 });
  const upcomingLessons = privateLessons.filter((lesson) => {
    const startAt = new Date(String(lesson.startAt ?? lesson.lessonDate));
    return startAt >= todayStart && startAt <= weekEnd;
  });

  return {
    cards: {
      todayLessons: upcomingLessons.filter((lesson) => new Date(String(lesson.startAt ?? lesson.lessonDate)) < todayEnd).length,
      weeklySchedule: enrollments.length + upcomingLessons.length,
      attendancePercentage: totalAttendance ? Math.round((present / totalAttendance) * 100) : 0,
      recentGrades: recentGrades.length,
      upcomingExams: recentGrades.filter((grade) => grade.type === "exam").length,
      homework: homework.length,
      recentNotifications: notifications.length,
      activeCourses: enrollments.filter((row) => ["approved", "accepted", "pending"].includes(String(row.status))).length,
      privateLessons: privateLessons.length,
      academicAverage: gradeTotals.max ? Math.round((gradeTotals.score / gradeTotals.max) * 100) : 0,
    },
    courses: enrollments.slice(0, 5).map(formatCourseEnrollment),
    recentGrades: recentGrades.map(formatGrade),
    privateLessons: privateLessons.map(formatPrivateLesson),
    notifications,
  };
}

export async function getStudentProfile() {
  const { student, studentId } = await requireStudent("student.profile.view");
  const [enrollments, links] = await Promise.all([
    getStudentEnrollments(studentId),
    StudentGuardianLink.find({ studentId }).populate({ path: "guardianId", model: Guardian, select: "fullName relationship primaryPhone email address" }).lean<Plain[]>(),
  ]);
  const teachers = enrollments.flatMap((enrollment) => {
    const courseTeacher = ((enrollment.course as Plain | undefined)?.teacher as Plain | undefined) ?? {};
    const enrollmentTeachers = Array.isArray(enrollment.teachers) ? enrollment.teachers : [];
    return [courseTeacher, ...enrollmentTeachers].filter((teacher) => idOf(teacher));
  });

  return {
    profile: studentSummary(student),
    assignedTeachers: teachers.map((teacher) => ({ id: idOf((teacher as Plain)._id), name: (teacher as Plain).name ?? "", subject: (teacher as Plain).subject ?? "" })),
    guardians: links.map((link) => {
      const guardian = (link.guardianId as Plain | undefined) ?? {};
      return { id: idOf(guardian._id), name: guardian.fullName ?? "", relationship: link.relationship ?? guardian.relationship ?? "", phone: guardian.primaryPhone ?? "", email: guardian.email ?? "", address: guardian.address ?? "" };
    }),
  };
}

export async function getStudentSchedule() {
  const { studentId } = await requireStudent("student.schedule.view");
  const [enrollments, privateLessons] = await Promise.all([
    getStudentEnrollments(studentId),
    PrivateLesson.find({ "students.studentId": studentId, deletedAt: null, status: { $nin: ["cancelled", "archived"] } }).populate({ path: "teacherId", model: Teacher, select: "name subject" }).sort({ startAt: 1 }).limit(100).lean<Plain[]>(),
  ]);
  return {
    courses: enrollments.map(formatCourseEnrollment),
    privateLessons: privateLessons.map(formatPrivateLesson),
    calendar: [
      ...enrollments.map(formatCourseEnrollment).map((row) => ({ type: "course", title: row.course.title, teacher: row.course.teacher.name, room: row.course.room, startDate: row.course.startDate, endDate: row.course.endDate, days: row.course.studyDays, startTime: row.course.startTime, endTime: row.course.endTime })),
      ...privateLessons.map(formatPrivateLesson).map((row) => ({ type: "private_lesson", title: row.subject, teacher: row.teacher, room: row.room, startDate: row.date, startTime: row.startTime, endTime: row.endTime })),
    ],
  };
}

export async function getStudentCourses() {
  const { studentId } = await requireStudent("student.schedule.view");
  return { courses: (await getStudentEnrollments(studentId)).map(formatCourseEnrollment) };
}

export async function getStudentAttendance() {
  const { studentId } = await requireStudent("student.attendance.view");
  const [records, summary] = await Promise.all([
    StudentAttendance.find({ studentId }).sort({ date: -1 }).limit(200).lean<Plain[]>(),
    StudentAttendance.aggregate([{ $match: { studentId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const total = summary.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const count = (status: string) => Number(summary.find((row) => row._id === status)?.count || 0);
  return {
    summary: { total, present: count("present"), absent: count("absent"), late: count("late"), excused: count("excused"), attendancePercentage: total ? Math.round((count("present") / total) * 100) : 0 },
    records: records.map((row) => ({ id: idOf(row._id), date: asDate(row.date), status: row.status ?? "", contextType: row.contextType ?? "", className: row.className ?? "", academicLevel: row.academicLevel ?? "", notes: row.notes ?? "", excuseReason: row.excuseReason ?? "" })),
  };
}

function formatGrade(row: Plain) {
  return {
    id: idOf(row._id),
    subject: row.subject ?? "",
    academicPeriod: row.academicPeriod ?? "",
    type: row.type ?? "",
    score: row.score ?? 0,
    maxScore: row.maxScore ?? 0,
    percentage: row.maxScore ? Math.round((Number(row.score || 0) / Number(row.maxScore)) * 100) : 0,
    average: row.average ?? null,
    remarks: row.remarks ?? "",
    strengths: row.strengths ?? "",
    weaknesses: row.weaknesses ?? "",
    recommendations: row.recommendations ?? "",
    createdAt: asDate(row.createdAt),
  };
}

export async function getStudentGrades() {
  const { studentId } = await requireStudent("student.grades.view");
  const [records, summary] = await Promise.all([
    StudentPerformance.find({ studentId }).sort({ createdAt: -1 }).limit(300).lean<Plain[]>(),
    StudentPerformance.aggregate([{ $match: { studentId } }, { $group: { _id: "$subject", score: { $sum: "$score" }, maxScore: { $sum: "$maxScore" }, count: { $sum: 1 } } }]),
  ]);
  const totals = records.reduce<{ score: number; max: number }>((acc, row) => ({ score: acc.score + Number(row.score || 0), max: acc.max + Number(row.maxScore || 0) }), { score: 0, max: 0 });
  return {
    overallAverage: totals.max ? Math.round((totals.score / totals.max) * 100) : 0,
    subjectAverages: summary.map((row) => ({ subject: row._id, count: row.count, average: row.maxScore ? Math.round((Number(row.score) / Number(row.maxScore)) * 100) : 0 })),
    records: records.map(formatGrade),
  };
}

function formatPrivateLesson(lesson: Plain) {
  const teacher = (lesson.teacherId as Plain | undefined) ?? {};
  return {
    id: idOf(lesson._id),
    subject: lesson.subject ?? "",
    teacher: teacher.name ?? "",
    date: asDate(lesson.lessonDate ?? lesson.startAt),
    startTime: lesson.startTime ?? "",
    endTime: lesson.endTime ?? "",
    room: lesson.room ?? lesson.location ?? "",
    status: lesson.status ?? "",
    attendance: lesson.studentAttendanceStatus ?? "",
    paymentStatus: lesson.paymentStatus ?? "",
    notes: lesson.notes ?? "",
  };
}

export async function getStudentPrivateLessons() {
  const { studentId } = await requireStudent("student.schedule.view");
  const lessons = await PrivateLesson.find({ "students.studentId": studentId, deletedAt: null }).populate({ path: "teacherId", model: Teacher, select: "name subject" }).sort({ startAt: -1 }).limit(150).lean<Plain[]>();
  const lessonIds = lessons.map((lesson) => lesson._id);
  const [notes, performance] = await Promise.all([
    PrivateLessonNote.find({ lessonId: { $in: lessonIds }, visibility: { $in: ["student", "staff"] } }).sort({ createdAt: -1 }).limit(100).lean<Plain[]>(),
    PrivateLessonPerformance.find({ studentId }).sort({ createdAt: -1 }).limit(100).lean<Plain[]>(),
  ]);
  return { lessons: lessons.map(formatPrivateLesson), notes, performance };
}

export async function getStudentFinance() {
  const { studentId } = await requireStudent("student.finance.view");
  const [charges, payments, discounts, refunds] = await Promise.all([
    StudentCharge.find({ studentId }).sort({ dueDate: -1, createdAt: -1 }).limit(200).lean<Plain[]>(),
    StudentPayment.find({ studentId }).sort({ paymentDate: -1, createdAt: -1 }).limit(100).lean<Plain[]>(),
    StudentDiscount.find({ studentId }).sort({ createdAt: -1 }).limit(100).lean<Plain[]>(),
    StudentRefund.find({ studentId }).sort({ refundDate: -1, createdAt: -1 }).limit(100).lean<Plain[]>(),
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

export async function getStudentDocuments() {
  const { student } = await requireStudent("student.documents.view");
  return {
    documents: (Array.isArray(student.documents) ? student.documents : []).map((document) => ({
      title: (document as Plain).title ?? "",
      type: (document as Plain).type ?? "other",
      url: (document as Plain).url ?? "",
      uploadedAt: asDate((document as Plain).uploadedAt),
      verificationStatus: (document as Plain).verificationStatus ?? "pending",
      notes: (document as Plain).notes ?? "",
    })),
  };
}

export async function getStudentCommunications() {
  const { studentId } = await requireStudent("student.communications.view");
  const [communications, notes, notifications] = await Promise.all([
    StudentCommunication.find({ studentId }).sort({ createdAt: -1 }).limit(100).lean<Plain[]>(),
    StudentNote.find({ studentId, visibility: { $in: ["student", "guardian"] } }).sort({ createdAt: -1 }).limit(100).lean<Plain[]>(),
    getStudentNotifications(studentId, 50),
  ]);
  return {
    communications: communications.map((item) => ({ id: idOf(item._id), channel: item.type, subject: item.subject, preview: String(item.content ?? "").slice(0, 160), recipient: item.recipient, status: item.deliveryStatus ?? "", createdAt: asDate(item.createdAt) })),
    notes: notes.map((note) => ({ id: idOf(note._id), category: note.category, note: note.note, createdAt: asDate(note.createdAt) })),
    notifications,
  };
}

export async function getStudentReports() {
  const [attendance, grades] = await Promise.all([getStudentAttendance(), getStudentGrades()]);
  return { attendance: attendance.summary, academic: { overallAverage: grades.overallAverage, subjectAverages: grades.subjectAverages }, generatedAt: new Date().toISOString() };
}

export async function getStudentPrintableReport() {
  const report = await getStudentReports();
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الطالب</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111827}.header{border-bottom:2px solid #db2777;padding-bottom:16px;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #e5e7eb;border-radius:8px;padding:14px}h1{color:#be185d}@media print{body{margin:18mm}}</style></head><body><div class="header"><h1>تقرير الطالب</h1><p>تاريخ التوليد: ${escapeHtml(report.generatedAt)}</p></div><div class="grid"><div class="card"><h2>الحضور</h2><p>النسبة: ${escapeHtml(report.attendance.attendancePercentage)}%</p><p>غياب: ${escapeHtml(report.attendance.absent)}</p><p>تأخر: ${escapeHtml(report.attendance.late)}</p></div><div class="card"><h2>الأداء</h2><p>المعدل العام: ${escapeHtml(report.academic.overallAverage)}%</p></div><div class="card"><h2>المواد</h2>${report.academic.subjectAverages.map((item) => `<p>${escapeHtml(item.subject)}: ${escapeHtml(item.average)}%</p>`).join("")}</div></div><script>window.print()</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function getStudentPdfReport() {
  const report = await getStudentReports();
  const pdf = await receiptPdf({
    title: "تقرير الطالب",
    receiptNumber: `STUDENT-${Date.now()}`,
    fields: [
      { label: "تاريخ التوليد", value: new Date(report.generatedAt).toLocaleString("ar-DZ") },
      { label: "نسبة الحضور", value: `${report.attendance.attendancePercentage}%` },
      { label: "عدد الغيابات", value: report.attendance.absent },
      { label: "عدد التأخرات", value: report.attendance.late },
      { label: "المعدل العام", value: `${report.academic.overallAverage}%` },
      { label: "عدد المواد", value: report.academic.subjectAverages.length },
    ],
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": "inline; filename=student-report.pdf",
    },
  });
}
