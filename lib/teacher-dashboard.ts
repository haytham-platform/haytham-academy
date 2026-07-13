import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Course from "@/models/Course";
import Enrollment from "@/models/Enrollment";
import Notification from "@/models/Notification";
import TeacherPayout from "@/models/TeacherPayout";
import TeacherPayment from "@/models/TeacherPayment";
import { PrivateLesson, PrivateLessonNote } from "@/models/PrivateLesson";
import { StudentAttendance, StudentCommunication, StudentNote, StudentPerformance, type IStudentAttendance, type IStudentPerformance } from "@/models/StudentRecords";

type AnyRecord = Record<string, unknown>;
type StudentAttendanceStatus = "present" | "absent" | "late" | "excused" | "left_early" | "cancelled";
type StudentPerformanceType = "test" | "exam" | "homework" | "participation" | "project" | "teacher_evaluation";
type StudentAttendanceContext = "class" | "course" | "support_lesson" | "private_lesson" | "kindergarten" | "other";

const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function idString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value) return String(value);
  return "";
}

function oid(value: unknown) {
  const id = idString(value);
  return mongoose.Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : undefined;
}

function objectIds(ids: string[]) {
  return ids.filter(mongoose.Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
}

function objectIdsFromRows(rows: AnyRecord[]) {
  return rows.map((row) => oid(row._id)).filter((id): id is Types.ObjectId => Boolean(id));
}

function attendanceStatus(value: unknown): StudentAttendanceStatus {
  return ["present", "absent", "late", "excused", "left_early", "cancelled"].includes(String(value)) ? String(value) as StudentAttendanceStatus : "present";
}

function attendanceContext(value: unknown): StudentAttendanceContext {
  return ["class", "course", "support_lesson", "private_lesson", "kindergarten", "other"].includes(String(value)) ? String(value) as StudentAttendanceContext : "class";
}

function performanceType(value: unknown): StudentPerformanceType {
  return ["test", "exam", "homework", "participation", "project", "teacher_evaluation"].includes(String(value)) ? String(value) as StudentPerformanceType : "test";
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function endOfWeek(date = new Date()) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function sanitize(value: unknown) {
  return String(value ?? "").replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").trim();
}

function formatTeacher(teacher: AnyRecord) {
  return {
    _id: idString(teacher._id),
    name: teacher.name || "",
    subject: teacher.subject || "",
    phone: teacher.phone || "",
    email: teacher.email || "",
    address: teacher.address || "",
    emergencyPhone: teacher.emergencyPhone || "",
    teachingLevel: teacher.teachingLevel || "",
    employmentType: teacher.employmentType || "",
    status: teacher.status || "",
    subjects: teacher.subjects || [],
    academicLevels: teacher.academicLevels || [],
    assignedClasses: teacher.assignedClasses || [],
    weeklySchedule: teacher.weeklySchedule || [],
    qualifications: teacher.qualifications || [],
    contracts: teacher.contracts || [],
    documents: teacher.documents || [],
    salaryConfig: teacher.salaryConfig || {},
    salaryHistory: teacher.salaryHistory || [],
    bonuses: teacher.bonuses || [],
    deductions: teacher.deductions || [],
    performanceRecords: teacher.performanceRecords || [],
    notes: teacher.notes || "",
  };
}

export async function requireTeacherPermission(permission: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new Error("غير مصرح");
  if (!hasPermission(user.role, permission)) throw new Error("ليس لديك صلاحية لهذا الإجراء");
  return user;
}

export async function getCurrentTeacher(permission: Permission = "teacher.dashboard.view") {
  await connectDB();
  const user = await requireTeacherPermission(permission);
  const query: AnyRecord[] = [];
  if (user.email) query.push({ email: user.email });
  if (user.phone) query.push({ phone: user.phone });
  query.push({ name: user.name });
  const teacher = await Teacher.findOne({ deletedAt: null, $or: query }).lean() as unknown as AnyRecord | null;
  if (!teacher) throw new Error("لم يتم ربط حسابك بسجل أستاذ. تحقق من البريد أو الهاتف في ملف الأستاذ.");
  return { user, teacher, teacherId: new Types.ObjectId(idString(teacher._id)) };
}

async function teacherCourses(teacherId: Types.ObjectId) {
  return Course.find({ teacher: teacherId, deletedAt: null }).sort({ startDate: -1 }).lean() as unknown as AnyRecord[];
}

async function teacherStudentIds(teacherId: Types.ObjectId) {
  const courses = await teacherCourses(teacherId);
  const courseIds = objectIdsFromRows(courses);
  const enrollments = await Enrollment.find({ course: { $in: courseIds }, status: { $in: ["approved", "accepted", "pending"] } }).select("student").lean() as unknown as AnyRecord[];
  return Array.from(new Set(enrollments.map((e) => idString(e.student)).filter(Boolean)));
}

function courseScheduleRows(courses: AnyRecord[]) {
  return courses.map((course) => ({
    _id: idString(course._id),
    type: "course",
    title: course.title || course.subject || "حصة",
    className: course.level || "",
    subject: course.title || "",
    room: course.room || "",
    startTime: course.startTime || "",
    endTime: course.endTime || "",
    studyDays: course.studyDays || "",
    startDate: course.startDate || "",
    endDate: course.endDate || "",
  }));
}

export async function getTeacherDashboardData() {
  const { user, teacher, teacherId } = await getCurrentTeacher("teacher.dashboard.view");
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const courses = await teacherCourses(teacherId);
  const studentIds = await teacherStudentIds(teacherId);
  const [todayPrivate, weeklyPrivate, attendanceToday, pendingGrades, payouts, payments, notifications, upcomingLessons] = await Promise.all([
    PrivateLesson.countDocuments({ teacherId, deletedAt: null, lessonDate: { $gte: todayStart, $lte: todayEnd } }),
    PrivateLesson.countDocuments({ teacherId, deletedAt: null, lessonDate: { $gte: weekStart, $lte: weekEnd } }),
    StudentAttendance.countDocuments({ teacherId, date: { $gte: todayStart, $lte: todayEnd } }),
    StudentPerformance.countDocuments({ teacherId, createdAt: { $gte: monthStart } }),
    TeacherPayout.find({ teacherId, invoiceStatus: { $ne: "cancelled" } }).sort({ payoutDate: -1 }).limit(20).lean(),
    TeacherPayment.find({ teacherId, status: "active" }).sort({ paymentDate: -1 }).limit(20).lean(),
    Notification.find({ $or: [{ userId: user._id }, { audienceRoles: "teacher" }, { audienceRoles: { $size: 0 }, userId: { $exists: false } }] }).sort({ createdAt: -1 }).limit(5).lean(),
    PrivateLesson.find({ teacherId, deletedAt: null, status: { $in: ["scheduled", "confirmed", "in_progress"] }, lessonDate: { $gte: todayStart } }).sort({ startAt: 1 }).limit(8).lean(),
  ]);
  const weeklyLessons = courses.length + weeklyPrivate;
  const payoutRows = payouts as unknown as AnyRecord[];
  const paymentRows = payments as unknown as AnyRecord[];
  const upcomingRows = upcomingLessons as unknown as AnyRecord[];
  const notificationRows = notifications as unknown as AnyRecord[];
  const monthlyEarnings = payoutRows.filter((p) => new Date(String(p.payoutDate || p.createdAt)).getTime() >= monthStart.getTime()).reduce((sum, p) => sum + Number(p.netTeacherAmount || p.totalDue || p.amount || 0), 0);
  const paid = paymentRows.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pending = payoutRows.reduce((sum, p) => sum + Number(p.remaining || 0), 0);
  return {
    teacher: formatTeacher(teacher),
    cards: {
      todayLessons: courseScheduleRows(courses).filter((c) => String(c.studyDays).includes(dayNames[new Date().getDay()])).length + todayPrivate,
      weeklyLessons,
      activeStudents: studentIds.length,
      privateLessonsToday: todayPrivate,
      attendanceToday,
      pendingAttendance: Math.max(0, studentIds.length - attendanceToday),
      pendingGrades: Math.max(0, studentIds.length - pendingGrades),
      upcomingLessons: upcomingRows.length,
      monthlyEarnings,
      paid,
      pending,
    },
    upcomingLessons: upcomingRows.map(formatPrivateLesson),
    notifications: notificationRows.map((n) => ({ _id: idString(n._id), title: n.title, message: n.message, createdAt: n.createdAt })),
  };
}

export async function getTeacherProfile() {
  const { teacher } = await getCurrentTeacher("teacher.dashboard.view");
  return { teacher: formatTeacher(teacher) };
}

export async function getTeacherSchedule() {
  const { teacher, teacherId } = await getCurrentTeacher("teacher.schedule.view");
  const [courses, privateLessons] = await Promise.all([
    teacherCourses(teacherId),
    PrivateLesson.find({ teacherId, deletedAt: null, status: { $nin: ["cancelled", "archived"] } }).sort({ startAt: 1 }).limit(500).lean(),
  ]);
  return {
    weeklySchedule: teacher.weeklySchedule || [],
    courses: courseScheduleRows(courses),
    privateLessons: (privateLessons as unknown as AnyRecord[]).map(formatPrivateLesson),
  };
}

export async function getTeacherStudents(searchParams: URLSearchParams) {
  const { teacherId } = await getCurrentTeacher("teacher.students.view");
  const ids = await teacherStudentIds(teacherId);
  const filter: AnyRecord = { role: "student", _id: { $in: ids.map((id) => new Types.ObjectId(id)) }, deletedAt: null };
  const search = searchParams.get("search")?.trim();
  if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }, { guardianName: { $regex: search, $options: "i" } }];
  for (const key of ["academicLevel", "className", "groupName", "status"]) {
    const value = searchParams.get(key);
    if (value) filter[key] = value;
  }
  const students = await User.find(filter).select("name phone guardianName guardianPhone academicLevel className groupName status").sort({ name: 1 }).limit(500).lean() as unknown as AnyRecord[];
  const studentObjectIds = objectIdsFromRows(students);
  const [attendance, performance, notes] = await Promise.all([
    StudentAttendance.find({ studentId: { $in: studentObjectIds } }).sort({ date: -1 }).limit(200).lean(),
    StudentPerformance.find({ studentId: { $in: studentObjectIds } }).sort({ createdAt: -1 }).limit(200).lean(),
    StudentNote.find({ studentId: { $in: studentObjectIds }, visibility: { $in: ["staff", "internal"] } }).sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  return { students: students.map((s) => ({ _id: idString(s._id), name: s.name, phone: s.phone, guardianName: s.guardianName, guardianPhone: s.guardianPhone, academicLevel: s.academicLevel, className: s.className, groupName: s.groupName, status: s.status })), attendance, performance, notes };
}

export async function getTeacherAttendance(searchParams: URLSearchParams) {
  const { teacherId } = await getCurrentTeacher("teacher.attendance.manage");
  const ids = await teacherStudentIds(teacherId);
  const filter: AnyRecord = { studentId: { $in: objectIds(ids) } };
  if (searchParams.get("status")) filter.status = searchParams.get("status");
  if (searchParams.get("studentId") && ids.includes(searchParams.get("studentId") || "")) filter.studentId = new Types.ObjectId(searchParams.get("studentId") || "");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from || to) filter.date = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: endOfDay(new Date(to)) } : {}) };
  const records = await StudentAttendance.find(filter).sort({ date: -1 }).limit(500).lean();
  return { records };
}

export async function saveTeacherAttendance(body: AnyRecord) {
  const { user, teacher, teacherId } = await getCurrentTeacher("teacher.attendance.manage");
  const ids = await teacherStudentIds(teacherId);
  const rows = Array.isArray(body.records) ? body.records : [body];
  const created: unknown[] = [];
  for (const row of rows as AnyRecord[]) {
    const studentId = idString(row.studentId);
    if (!ids.includes(studentId)) throw new Error("الطالب غير مسند لهذا الأستاذ");
    const payload: Partial<IStudentAttendance> = {
      studentId: new Types.ObjectId(studentId),
      contextType: attendanceContext(row.contextType),
      contextId: oid(row.contextId),
      courseId: oid(row.courseId),
      teacherId,
      academicSeason: sanitize(row.academicSeason),
      academicLevel: sanitize(row.academicLevel),
      className: sanitize(row.className),
      date: row.date ? new Date(String(row.date)) : new Date(),
      status: attendanceStatus(row.status),
      excuseReason: sanitize(row.excuseReason),
      notes: sanitize(row.notes),
      recordedBy: new Types.ObjectId(user._id),
      correctionHistory: [],
    };
    const record = await StudentAttendance.create(payload);
    created.push(record);
  }
  await recordAudit({ userId: user._id, action: "teacher.attendance.record", recordType: "teacher", recordId: idString(teacher._id), metadata: { count: created.length } });
  return { records: created };
}

export async function getTeacherGrades(searchParams: URLSearchParams) {
  const { teacherId } = await getCurrentTeacher("teacher.grades.manage");
  const ids = await teacherStudentIds(teacherId);
  const filter: AnyRecord = { studentId: { $in: objectIds(ids) } };
  if (searchParams.get("studentId") && ids.includes(searchParams.get("studentId") || "")) filter.studentId = new Types.ObjectId(searchParams.get("studentId") || "");
  if (searchParams.get("type")) filter.type = searchParams.get("type");
  if (searchParams.get("subject")) filter.subject = searchParams.get("subject");
  const records = await StudentPerformance.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  const summary = await StudentPerformance.aggregate([{ $match: filter }, { $group: { _id: "$studentId", average: { $avg: { $multiply: [{ $divide: ["$score", "$maxScore"] }, 100] } }, count: { $sum: 1 } } }]);
  return { records, summary };
}

export async function saveTeacherGrade(body: AnyRecord) {
  const { user, teacher, teacherId } = await getCurrentTeacher("teacher.grades.manage");
  const ids = await teacherStudentIds(teacherId);
  const rows = Array.isArray(body.records) ? body.records : [body];
  const created: unknown[] = [];
  for (const row of rows as AnyRecord[]) {
    const studentId = idString(row.studentId);
    if (!ids.includes(studentId)) throw new Error("الطالب غير مسند لهذا الأستاذ");
    const score = Number(row.score);
    const maxScore = Number(row.maxScore || 20);
    const payload: Partial<IStudentPerformance> = {
      studentId: new Types.ObjectId(studentId),
      subject: sanitize(row.subject || teacher.subject),
      academicSeason: sanitize(row.academicSeason),
      academicPeriod: sanitize(row.academicPeriod),
      teacherId,
      type: performanceType(row.type),
      score,
      maxScore,
      average: maxScore ? Math.round((score / maxScore) * 100) : 0,
      remarks: sanitize(row.remarks),
      createdBy: new Types.ObjectId(user._id),
      changeHistory: [],
    };
    const record = await StudentPerformance.create(payload);
    created.push(record);
  }
  await recordAudit({ userId: user._id, action: "teacher.grade.record", recordType: "teacher", recordId: idString(teacher._id), metadata: { count: created.length } });
  return { records: created };
}

export async function getTeacherPrivateLessons() {
  const { teacherId } = await getCurrentTeacher("teacher.private_lessons.view");
  const lessons = await PrivateLesson.find({ teacherId, deletedAt: null }).sort({ startAt: -1 }).limit(500).lean() as unknown as AnyRecord[];
  const notes = await PrivateLessonNote.find({ lessonId: { $in: lessons.map((l) => l._id) }, visibility: { $in: ["teacher", "staff"] } }).sort({ createdAt: -1 }).limit(100).lean();
  return { lessons: lessons.map(formatPrivateLesson), notes };
}

export async function getTeacherFinance() {
  const { teacher, teacherId } = await getCurrentTeacher("teacher.finance.view");
  const [payouts, payments] = await Promise.all([
    TeacherPayout.find({ teacherId, invoiceStatus: { $ne: "cancelled" } }).sort({ payoutDate: -1 }).limit(500).lean() as unknown as AnyRecord[],
    TeacherPayment.find({ teacherId }).sort({ paymentDate: -1 }).limit(500).lean() as unknown as AnyRecord[],
  ]);
  const totalEarnings = payouts.reduce((sum, p) => sum + Number(p.netTeacherAmount || p.totalDue || p.amount || 0), 0);
  const paid = payments.filter((p) => p.status !== "cancelled").reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pending = payouts.reduce((sum, p) => sum + Number(p.remaining || 0), 0);
  const bonuses = (teacher.bonuses as AnyRecord[] | undefined || []).reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const deductions = (teacher.deductions as AnyRecord[] | undefined || []).reduce((sum, d) => sum + Number(d.amount || 0), 0);
  return { summary: { currentBalance: pending, totalEarnings, paid, pending, bonuses, deductions }, payouts, payments };
}

export async function getTeacherCommunications() {
  const { user, teacher, teacherId } = await getCurrentTeacher("teacher.dashboard.view");
  const studentIds = await teacherStudentIds(teacherId);
  const [notifications, communications] = await Promise.all([
    Notification.find({ $or: [{ userId: user._id }, { audienceRoles: "teacher" }, { audienceRoles: { $size: 0 }, userId: { $exists: false } }] }).sort({ createdAt: -1 }).limit(100).lean(),
    StudentCommunication.find({ studentId: { $in: objectIds(studentIds) }, type: { $in: ["guardian_meeting", "phone_call", "administrative_notice", "internal_notification"] } }).sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  return { teacher: formatTeacher(teacher), notifications, communications };
}

export async function getTeacherDocuments() {
  const { teacher } = await getCurrentTeacher("teacher.documents.view");
  return { documents: teacher.documents || [], contracts: teacher.contracts || [] };
}

export async function getTeacherReports(searchParams: URLSearchParams) {
  const { teacherId } = await getCurrentTeacher("teacher.reports.view");
  const ids = await teacherStudentIds(teacherId);
  const [attendance, grades, lessons, privateLessons] = await Promise.all([
    StudentAttendance.aggregate([{ $match: { studentId: { $in: objectIds(ids) } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    StudentPerformance.aggregate([{ $match: { studentId: { $in: objectIds(ids) } } }, { $group: { _id: "$type", count: { $sum: 1 }, average: { $avg: "$average" } } }]),
    Course.countDocuments({ teacher: teacherId, deletedAt: null }),
    PrivateLesson.countDocuments({ teacherId, deletedAt: null }),
  ]);
  const exportMode = searchParams.get("export");
  const report = { attendance, grades, lessons, privateLessons, generatedAt: new Date().toISOString() };
  if (exportMode) return { report, exportMode };
  return { report };
}

function formatPrivateLesson(lesson: AnyRecord) {
  return {
    _id: idString(lesson._id),
    subject: lesson.subject,
    academicLevel: lesson.academicLevel,
    lessonDate: lesson.lessonDate,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    room: lesson.room || lesson.location || "",
    status: lesson.status,
    paymentStatus: lesson.paymentStatus,
    students: lesson.students || [],
    compensation: lesson.compensation || {},
  };
}
