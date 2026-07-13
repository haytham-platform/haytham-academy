import mongoose from "mongoose";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Course from "@/models/Course";
import Enrollment from "@/models/Enrollment";
import Expense from "@/models/Expense";
import TeacherPayout from "@/models/TeacherPayout";
import TeacherPayment from "@/models/TeacherPayment";
import TransportSubscription from "@/models/TransportSubscription";
import AuditLog from "@/models/AuditLog";
import FinancialAuditLog from "@/models/FinancialAuditLog";
import KindergartenRegistration from "@/models/Kindergarten";
import AcademicSeason from "@/models/AcademicSeason";
import RolloverJob from "@/models/RolloverJob";
import { Communication, CommunicationDelivery, CommunicationPreference } from "@/models/Communication";
import { PrivateLesson, TeacherLessonCompensation } from "@/models/PrivateLesson";
import { StudentAttendance, StudentPerformance } from "@/models/StudentRecords";
import { StudentCharge, StudentPayment, StudentRefund } from "@/models/StudentFinance";
import { buildPaginationMeta, parsePagination, type PaginatedMeta, type PaginationParams } from "@/lib/pagination";
import { csvResponse, toCsv } from "@/lib/academic";
import { getReceiptAcademyInfo, receiptPdf } from "@/lib/receipt-documents";

export type ReportExportFormat = "json" | "csv" | "excel" | "pdf" | "print";

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportDefinition {
  key: string;
  title: string;
  category: string;
  permission: string;
  description: string;
}

export interface ReportResult {
  key: string;
  title: string;
  category: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary: Record<string, number | string>;
  filters: Record<string, string>;
  pagination?: PaginatedMeta;
  generatedAt: string;
}

// Mongoose lean/populate/aggregate rows vary by report; normalize them at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  { key: "students", title: "قائمة الطلاب", category: "students", permission: "reports.students", description: "كل الطلاب غير المؤرشفين" },
  { key: "active_students", title: "الطلاب النشطون", category: "students", permission: "reports.students", description: "طلاب بحالة نشطة" },
  { key: "suspended_students", title: "الطلاب الموقوفون", category: "students", permission: "reports.students", description: "طلاب موقوفون مؤقتا" },
  { key: "graduated_students", title: "الطلاب المتخرجون", category: "students", permission: "reports.students", description: "طلاب مكتملو المسار" },
  { key: "archived_students", title: "الطلاب المؤرشفون", category: "students", permission: "reports.students", description: "طلاب مؤرشفون أو محذوفون من التشغيل" },
  { key: "new_registrations", title: "التسجيلات الجديدة", category: "students", permission: "reports.students", description: "طلاب مسجلون ضمن الفترة" },
  { key: "students_by_level", title: "الطلاب حسب المستوى", category: "students", permission: "reports.students", description: "تجميع الطلاب حسب المستوى" },
  { key: "students_by_class", title: "الطلاب حسب القسم", category: "students", permission: "reports.students", description: "تجميع الطلاب حسب القسم" },
  { key: "students_by_guardian", title: "الطلاب حسب الولي", category: "students", permission: "reports.students", description: "تجميع الطلاب حسب الولي أو هاتفه" },
  { key: "students_by_municipality", title: "الطلاب حسب البلدية", category: "students", permission: "reports.students", description: "توزيع الطلاب حسب البلدية" },
  { key: "students_by_transportation", title: "الطلاب حسب النقل", category: "transportation", permission: "reports.students", description: "اشتراكات النقل المرتبطة بالطلاب" },
  { key: "medical_students", title: "المعلومات الطبية", category: "students", permission: "reports.students", description: "طلاب لديهم ملاحظات طبية" },
  { key: "outstanding_balances", title: "الأرصدة المستحقة", category: "finance", permission: "reports.finance", description: "رسوم الطلاب غير المسددة" },
  { key: "teachers", title: "الأساتذة النشطون", category: "teachers", permission: "reports.teachers", description: "قائمة الأساتذة وبيانات التكليف" },
  { key: "teacher_attendance", title: "حضور الأساتذة", category: "teachers", permission: "reports.teachers", description: "سجلات الحضور المخزنة في ملفات الأساتذة" },
  { key: "teacher_assignments", title: "تكليفات الأساتذة", category: "teachers", permission: "reports.teachers", description: "الأقسام والدورات المسندة" },
  { key: "teacher_salaries", title: "ملخص رواتب الأساتذة", category: "teachers", permission: "reports.teachers", description: "الفواتير والمستحقات والمدفوعات" },
  { key: "teacher_bonuses", title: "مكافآت الأساتذة", category: "teachers", permission: "reports.teachers", description: "المكافآت المسجلة" },
  { key: "teacher_deductions", title: "اقتطاعات الأساتذة", category: "teachers", permission: "reports.teachers", description: "الاقتطاعات المسجلة" },
  { key: "teacher_payments", title: "مدفوعات الأساتذة", category: "teachers", permission: "reports.teachers", description: "سجل تسديد مستحقات الأساتذة" },
  { key: "teacher_private_earnings", title: "أرباح الحصص الخاصة للأساتذة", category: "private_lessons", permission: "reports.private_lessons", description: "تعويضات الحصص الخاصة حسب الأستاذ" },
  { key: "courses", title: "الدورات", category: "courses", permission: "reports.view", description: "قائمة الدورات والطاقة الاستيعابية" },
  { key: "enrollments", title: "التسجيلات", category: "enrollments", permission: "reports.view", description: "طلبات التسجيل حسب الفترة والحالة" },
  { key: "finance_income", title: "الدخل المالي", category: "finance", permission: "reports.finance", description: "تحصيلات الطلاب حسب النوع والفترة" },
  { key: "daily_income", title: "الدخل اليومي", category: "revenue", permission: "reports.finance", description: "الإيراد مجمعا باليوم" },
  { key: "weekly_income", title: "الدخل الأسبوعي", category: "revenue", permission: "reports.finance", description: "الإيراد مجمعا بالأسبوع" },
  { key: "monthly_income", title: "الدخل الشهري", category: "revenue", permission: "reports.finance", description: "الإيراد مجمعا بالشهر" },
  { key: "yearly_income", title: "الدخل السنوي", category: "revenue", permission: "reports.finance", description: "الإيراد مجمعا بالسنة" },
  { key: "registration_fees", title: "رسوم التسجيل", category: "revenue", permission: "reports.finance", description: "تحصيلات ورسوم التسجيل" },
  { key: "tuition_fees", title: "رسوم الدراسة", category: "revenue", permission: "reports.finance", description: "رسوم الدورات والمستويات" },
  { key: "kindergarten_income", title: "دخل الروضة", category: "kindergarten", permission: "reports.kindergarten", description: "مدفوعات الروضة" },
  { key: "private_lesson_income", title: "دخل الحصص الخاصة", category: "private_lessons", permission: "reports.private_lessons", description: "إيرادات الحصص الخاصة" },
  { key: "transportation_income", title: "دخل النقل", category: "transportation", permission: "reports.finance", description: "رسوم النقل المسجلة في مالية الطلاب" },
  { key: "other_income", title: "دخل آخر", category: "revenue", permission: "reports.finance", description: "الإيرادات الأخرى" },
  { key: "expenses", title: "المصاريف", category: "expenses", permission: "reports.finance", description: "مصروفات الأكاديمية" },
  { key: "net_profit", title: "صافي الربح", category: "revenue", permission: "reports.finance", description: "الدخل ناقص المصاريف والاسترجاعات" },
  { key: "debts", title: "الديون", category: "finance", permission: "reports.finance", description: "الأرصدة المتأخرة أو المفتوحة" },
  { key: "refunds", title: "الاسترجاعات", category: "finance", permission: "reports.finance", description: "استرجاعات الطلاب" },
  { key: "cash_flow", title: "التدفق النقدي", category: "finance", permission: "reports.finance", description: "الحركة الداخلة والخارجة" },
  { key: "student_attendance", title: "الحضور اليومي", category: "attendance", permission: "reports.attendance", description: "سجلات حضور الطلاب" },
  { key: "monthly_attendance", title: "الحضور الشهري", category: "attendance", permission: "reports.attendance", description: "الحضور مجمعا بالشهر" },
  { key: "attendance_summary", title: "نسب الحضور", category: "attendance", permission: "reports.attendance", description: "حضور وغياب وتأخر بالنسبة المئوية" },
  { key: "attendance_by_class", title: "الحضور حسب القسم", category: "attendance", permission: "reports.attendance", description: "الحضور مجمعا حسب القسم" },
  { key: "attendance_by_teacher", title: "الحضور حسب الأستاذ", category: "attendance", permission: "reports.attendance", description: "الحضور مجمعا حسب الأستاذ" },
  { key: "attendance_by_course", title: "الحضور حسب الدورة", category: "attendance", permission: "reports.attendance", description: "الحضور مجمعا حسب الدورة" },
  { key: "attendance_by_kindergarten", title: "حضور الروضة", category: "attendance", permission: "reports.kindergarten", description: "حضور سياق الروضة" },
  { key: "private_lessons", title: "الحصص الخاصة", category: "private_lessons", permission: "reports.private_lessons", description: "الحصص الخاصة والإيراد والحضور" },
  { key: "private_lesson_attendance", title: "حضور الحصص الخاصة", category: "private_lessons", permission: "reports.private_lessons", description: "حضور الطلاب في الحصص الخاصة" },
  { key: "kindergarten", title: "الروضة", category: "kindergarten", permission: "reports.kindergarten", description: "اشتراكات وأرصدة الروضة" },
  { key: "transportation", title: "النقل", category: "transportation", permission: "reports.view", description: "اشتراكات النقل النشطة والمنتهية" },
  { key: "academic_performance", title: "الأداء الأكاديمي", category: "academic_performance", permission: "reports.students", description: "النتائج والتقييمات الأكاديمية" },
  { key: "payments", title: "المدفوعات", category: "payments", permission: "reports.finance", description: "كل مدفوعات الطلاب" },
  { key: "receipts", title: "الوصولات", category: "receipts", permission: "reports.finance", description: "وصولات التحصيل" },
  { key: "invoices", title: "الفواتير", category: "invoices", permission: "reports.finance", description: "فواتير ومستحقات الأساتذة" },
  { key: "audit_logs", title: "سجلات التدقيق", category: "audit_logs", permission: "reports.view", description: "عمليات التدقيق العامة والمالية" },
  { key: "dashboard_analytics", title: "تحليلات لوحة التحكم", category: "analytics", permission: "reports.view", description: "مؤشرات ورسوم لوحة التحكم" },
  { key: "rollover_students", title: "الطلاب المرحلون", category: "academic_seasons", permission: "reports.students", description: "نتائج ترحيل الطلاب حسب الموسم" },
  { key: "promoted_students", title: "الطلاب المرقون", category: "academic_seasons", permission: "reports.students", description: "طلاب تمت ترقيتهم" },
  { key: "repeating_students", title: "الطلاب المعيدون", category: "academic_seasons", permission: "reports.students", description: "طلاب أعادوا المستوى" },
  { key: "transferred_students", title: "الطلاب المحولون", category: "academic_seasons", permission: "reports.students", description: "طلاب تم تحويلهم" },
  { key: "rollover_graduated_students", title: "خريجو الترحيل", category: "academic_seasons", permission: "reports.students", description: "طلاب تخرجوا عبر الترحيل" },
  { key: "rollover_withdrawn_students", title: "منسحبو الترحيل", category: "academic_seasons", permission: "reports.students", description: "طلاب انسحبوا عبر الترحيل" },
  { key: "rollover_archived_students", title: "مؤرشفو الترحيل", category: "academic_seasons", permission: "reports.students", description: "طلاب أرشفوا عبر الترحيل" },
  { key: "failed_rollover_items", title: "عناصر الترحيل الفاشلة", category: "academic_seasons", permission: "reports.students", description: "العناصر التي فشل تنفيذها" },
  { key: "rollover_conflicts", title: "تعارضات الترحيل", category: "academic_seasons", permission: "reports.students", description: "تعارضات وتحذيرات المعاينة" },
  { key: "financial_carry_forward", title: "ترحيل الأرصدة المالية", category: "academic_seasons", permission: "reports.finance", description: "الأرصدة الافتتاحية المرحّلة" },
  { key: "transportation_rollover", title: "ترحيل النقل", category: "academic_seasons", permission: "reports.view", description: "تحذيرات النقل في الترحيل" },
  { key: "kindergarten_rollover", title: "ترحيل الروضة", category: "academic_seasons", permission: "reports.kindergarten", description: "تحذيرات الروضة في الترحيل" },
  { key: "season_comparison", title: "مقارنة المواسم", category: "academic_seasons", permission: "reports.view", description: "مقارنة طلاب وإيرادات المواسم" },
  { key: "communications_sent", title: "????????? ???????", category: "communications", permission: "reports.view", description: "??? ????????? ??? ??????" },
  { key: "communications_by_channel", title: "????????? ??? ??????", category: "communications", permission: "reports.view", description: "????? ????????? ??? ??????" },
  { key: "communications_by_category", title: "????????? ??? ?????", category: "communications", permission: "reports.view", description: "????? ????????? ??? ?????" },
  { key: "communication_delivery_rate", title: "???? ???????", category: "communications", permission: "reports.view", description: "??? ??????? ??????" },
  { key: "communication_failure_rate", title: "???? ?????", category: "communications", permission: "reports.view", description: "????? ??? ???????" },
  { key: "pending_communications", title: "????????? ???????", category: "communications", permission: "reports.view", description: "???????? ???????? ???????" },
  { key: "scheduled_communications", title: "????????? ????????", category: "communications", permission: "reports.view", description: "????????? ????????" },
  { key: "attendance_alerts_report", title: "??????? ??????", category: "communications", permission: "reports.attendance", description: "????? ?????? ???????" },
  { key: "payment_reminders_report", title: "??????? ?????", category: "communications", permission: "reports.finance", description: "??????? ?????????" },
  { key: "bulk_communication_results", title: "????? ??????? ???????", category: "communications", permission: "reports.view", description: "????? ??????? ?????? ?????????" },
  { key: "communication_opt_out_statistics", title: "???????? ????????", category: "communications", permission: "reports.view", description: "??????? ???? ?????? ???????" },
  { key: "provider_performance", title: "???? ????????", category: "communications", permission: "reports.view", description: "???? ?????? ??? ??????? ??????" },];

const definitionMap = new Map(REPORT_DEFINITIONS.map((definition) => [definition.key, definition]));

export function reportDefinition(type: string) {
  return definitionMap.get(type);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dateRange(searchParams: URLSearchParams, field = "createdAt") {
  const range: AnyRecord = {};
  const from = searchParams.get("from") || searchParams.get("dateFrom");
  const to = searchParams.get("to") || searchParams.get("dateTo");
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return Object.keys(range).length ? { [field]: range } : {};
}

function cleanFilters(searchParams: URLSearchParams) {
  const keys = ["academicSeason", "from", "to", "academicLevel", "teacherId", "courseId", "className", "group", "studentStatus", "paymentStatus", "attendanceStatus", "search"];
  return Object.fromEntries(keys.map((key) => [key, searchParams.get(key) || ""]).filter(([, value]) => value));
}

function objectId(value: string | null) {
  return value && mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

function amount(minor: unknown) {
  return Math.round(Number(minor ?? 0) / 100);
}

function formatDate(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("ar-DZ");
}

function display(value: unknown): string {
  if (value instanceof Date) return formatDate(value);
  if (value && typeof value === "object") {
    const obj = value as AnyRecord;
    return obj.name ?? obj.title ?? obj.childName ?? obj.receiptNumber ?? "";
  }
  return String(value ?? "");
}

function reportBase(type: string, rows: Record<string, unknown>[], columns: ReportColumn[], summary: Record<string, number | string>, searchParams: URLSearchParams, pagination?: PaginatedMeta): ReportResult {
  const definition = reportDefinition(type);
  return {
    key: type,
    title: definition?.title ?? "تقرير",
    category: definition?.category ?? "reports",
    columns,
    rows,
    summary,
    filters: cleanFilters(searchParams),
    pagination,
    generatedAt: new Date().toISOString(),
  };
}

async function paged<T>(query: mongoose.Query<T[], unknown>, count: Promise<number>, pagination: PaginationParams) {
  const [rows, total] = await Promise.all([query.skip(pagination.skip).limit(pagination.limit).lean(), count]);
  return { rows: rows as AnyRecord[], total };
}

function studentFilter(type: string, searchParams: URLSearchParams) {
  const filter: AnyRecord = { role: "student" };
  if (type !== "archived_students") filter.deletedAt = null;
  if (type === "active_students") filter.status = "active";
  if (type === "suspended_students") filter.status = "suspended";
  if (type === "graduated_students") filter.status = "graduated";
  if (type === "archived_students") filter.$or = [{ deletedAt: { $ne: null } }, { status: "archived" }];
  if (type === "medical_students") filter.medicalNotes = { $nin: [null, ""] };
  Object.assign(filter, dateRange(searchParams, type === "new_registrations" ? "registrationDate" : "createdAt"));

  const academicSeason = searchParams.get("academicSeason");
  const academicLevel = searchParams.get("academicLevel");
  const className = searchParams.get("className") || searchParams.get("group");
  const status = searchParams.get("studentStatus");
  const search = searchParams.get("search")?.trim();
  if (academicSeason) filter.academicSeason = academicSeason;
  if (academicLevel) filter.$and = [...(filter.$and ?? []), { $or: [{ academicLevel }, { studyLevel: academicLevel }] }];
  if (className) filter.$and = [...(filter.$and ?? []), { $or: [{ className }, { groupName: className }] }];
  if (status) filter.status = status;
  if (search) {
    filter.$and = [...(filter.$and ?? []), {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { studentNumber: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { guardianName: { $regex: search, $options: "i" } },
        { guardianPhone: { $regex: search, $options: "i" } },
        { municipality: { $regex: search, $options: "i" } },
        { commune: { $regex: search, $options: "i" } },
      ],
    }];
  }
  return filter;
}

const studentColumns: ReportColumn[] = [
  { key: "studentNumber", label: "رقم الطالب" },
  { key: "name", label: "الطالب" },
  { key: "phone", label: "الهاتف" },
  { key: "guardian", label: "الولي" },
  { key: "academicLevel", label: "المستوى" },
  { key: "className", label: "القسم" },
  { key: "status", label: "الحالة" },
  { key: "registrationDate", label: "تاريخ التسجيل" },
];

async function studentReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  if (type === "outstanding_balances" || type === "debts") return outstandingReport(type, searchParams, pagination);
  if (type === "students_by_transportation") return transportationReport(type, searchParams, pagination);

  const filter = studentFilter(type, searchParams);
  if (["students_by_level", "students_by_class", "students_by_guardian", "students_by_municipality"].includes(type)) {
    const field = type === "students_by_level" ? "$academicLevel" : type === "students_by_class" ? "$className" : type === "students_by_guardian" ? "$guardianPhone" : "$municipality";
    const [rows, countRows] = await Promise.all([
      User.aggregate([{ $match: filter }, { $group: { _id: field, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $skip: pagination.skip }, { $limit: pagination.limit }]),
      User.aggregate([{ $match: filter }, { $group: { _id: field } }, { $count: "total" }]),
    ]);
    const total = countRows[0]?.total ?? 0;
    return reportBase(type, rows.map((row) => ({ name: row._id || "غير محدد", count: row.count })), [{ key: "name", label: "التصنيف" }, { key: "count", label: "العدد" }], { totalGroups: total }, searchParams, buildPaginationMeta(total, pagination));
  }

  const { rows, total } = await paged(User.find(filter).select("-password").sort({ createdAt: -1 }), User.countDocuments(filter), pagination);
  const formatted = rows.map((row) => ({
    studentNumber: row.studentNumber,
    name: row.name,
    phone: row.phone,
    guardian: row.guardianName || row.guardianPhone,
    academicLevel: row.academicLevel || row.studyLevel,
    className: row.className || row.groupName,
    status: row.status,
    registrationDate: formatDate(row.registrationDate || row.createdAt),
    medicalNotes: row.medicalNotes,
    municipality: row.municipality || row.commune,
  }));
  const columns = type === "medical_students" ? [...studentColumns, { key: "medicalNotes", label: "ملاحظات طبية" }] : studentColumns;
  return reportBase(type, formatted, columns, { total }, searchParams, buildPaginationMeta(total, pagination));
}

async function outstandingReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  const filter: AnyRecord = { balanceMinor: { $gt: 0 }, status: { $nin: ["cancelled", "paid", "exempted"] } };
  Object.assign(filter, dateRange(searchParams, "dueDate"));
  if (searchParams.get("academicSeason")) filter.academicSeason = searchParams.get("academicSeason");
  if (searchParams.get("paymentStatus")) filter.status = searchParams.get("paymentStatus");
  if (searchParams.get("courseId")) filter.courseId = objectId(searchParams.get("courseId")) ?? searchParams.get("courseId");
  const [rows, total, summary] = await Promise.all([
    StudentCharge.find(filter).populate("studentId", "name phone academicLevel className").populate("courseId", "title").sort({ balanceMinor: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    StudentCharge.countDocuments(filter),
    StudentCharge.aggregate([{ $match: filter }, { $group: { _id: "$chargeType", total: { $sum: "$balanceMinor" }, count: { $sum: 1 } } }]),
  ]);
  return reportBase(type, rows.map((row: AnyRecord) => ({
    student: display(row.studentId),
    type: row.chargeType,
    description: row.description,
    balance: amount(row.balanceMinor),
    status: row.status,
    dueDate: formatDate(row.dueDate),
  })), [
    { key: "student", label: "الطالب" },
    { key: "type", label: "النوع" },
    { key: "description", label: "الوصف" },
    { key: "balance", label: "المتبقي" },
    { key: "status", label: "الحالة" },
    { key: "dueDate", label: "الاستحقاق" },
  ], { total, outstanding: amount(summary.reduce((sum: number, row: AnyRecord) => sum + row.total, 0)) }, searchParams, buildPaginationMeta(total, pagination));
}

async function teachersReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  const teacherId = objectId(searchParams.get("teacherId"));
  if (type === "teacher_attendance") {
    const match: AnyRecord = { deletedAt: null, "attendance.0": { $exists: true } };
    if (teacherId) match._id = teacherId;
    const rows = await Teacher.aggregate([{ $match: match }, { $unwind: "$attendance" }, { $match: dateRange(searchParams, "attendance.date") }, { $sort: { "attendance.date": -1 } }, { $skip: pagination.skip }, { $limit: pagination.limit }]);
    const totalRows = await Teacher.aggregate([{ $match: match }, { $unwind: "$attendance" }, { $match: dateRange(searchParams, "attendance.date") }, { $count: "total" }]);
    const total = totalRows[0]?.total ?? 0;
    return reportBase(type, rows.map((row) => ({ teacher: row.name, status: row.attendance.status, date: formatDate(row.attendance.date), note: row.attendance.note })), [{ key: "teacher", label: "الأستاذ" }, { key: "status", label: "الحالة" }, { key: "date", label: "التاريخ" }, { key: "note", label: "ملاحظة" }], { total }, searchParams, buildPaginationMeta(total, pagination));
  }
  if (type === "teacher_bonuses" || type === "teacher_deductions") {
    const field = type === "teacher_bonuses" ? "bonuses" : "deductions";
    const rows = await Teacher.aggregate([{ $match: { deletedAt: null, ...(teacherId ? { _id: teacherId } : {}) } }, { $unwind: `$${field}` }, { $match: dateRange(searchParams, `${field}.date`) }, { $sort: { [`${field}.date`]: -1 } }, { $skip: pagination.skip }, { $limit: pagination.limit }]);
    const totalRows = await Teacher.aggregate([{ $match: { deletedAt: null, ...(teacherId ? { _id: teacherId } : {}) } }, { $unwind: `$${field}` }, { $match: dateRange(searchParams, `${field}.date`) }, { $group: { _id: null, total: { $sum: `$${field}.amount` }, count: { $sum: 1 } } }]);
    return reportBase(type, rows.map((row) => ({ teacher: row.name, title: row[field].title, amount: row[field].amount, date: formatDate(row[field].date), note: row[field].note })), [{ key: "teacher", label: "الأستاذ" }, { key: "title", label: "البند" }, { key: "amount", label: "المبلغ" }, { key: "date", label: "التاريخ" }, { key: "note", label: "ملاحظة" }], { total: totalRows[0]?.count ?? 0, amount: totalRows[0]?.total ?? 0 }, searchParams, buildPaginationMeta(totalRows[0]?.count ?? 0, pagination));
  }
  if (type === "teacher_payments") {
    const filter: AnyRecord = { status: "active", ...dateRange(searchParams, "paymentDate") };
    if (teacherId) filter.teacherId = teacherId;
    const [rows, total, summary] = await Promise.all([
      TeacherPayment.find(filter).populate("teacherId", "name").sort({ paymentDate: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      TeacherPayment.countDocuments(filter),
      TeacherPayment.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    ]);
    return reportBase(type, rows.map((row: AnyRecord) => ({ teacher: display(row.teacherId), receipt: row.receiptNumber, amount: row.amount, method: row.paymentMethod, date: formatDate(row.paymentDate) })), [{ key: "teacher", label: "الأستاذ" }, { key: "receipt", label: "الوصل" }, { key: "amount", label: "المبلغ" }, { key: "method", label: "الطريقة" }, { key: "date", label: "التاريخ" }], { total, paid: summary[0]?.total ?? 0 }, searchParams, buildPaginationMeta(total, pagination));
  }
  if (type === "teacher_private_earnings" || type === "teacher_salaries") {
    return teacherEarningsReport(type, searchParams, pagination);
  }

  const filter: AnyRecord = { deletedAt: null };
  if (teacherId) filter._id = teacherId;
  const status = searchParams.get("studentStatus");
  if (status) filter.status = status;
  const { rows, total } = await paged(Teacher.find(filter).sort({ createdAt: -1 }), Teacher.countDocuments(filter), pagination);
  const columns = type === "teacher_assignments"
    ? [{ key: "name", label: "الأستاذ" }, { key: "subjects", label: "المواد" }, { key: "assignedClasses", label: "الأقسام" }, { key: "schedule", label: "البرنامج" }]
    : [{ key: "name", label: "الأستاذ" }, { key: "subject", label: "المادة" }, { key: "phone", label: "الهاتف" }, { key: "status", label: "الحالة" }, { key: "salary", label: "الأجر" }];
  return reportBase(type, rows.map((row) => ({
    name: row.name,
    subject: row.subject,
    phone: row.phone,
    status: row.status,
    salary: row.salaryConfig?.baseSalary || row.salaryConfig?.sessionRate || row.salaryConfig?.hourlyRate || 0,
    subjects: (row.subjects ?? []).join("، "),
    assignedClasses: (row.assignedClasses ?? []).join("، "),
    schedule: (row.weeklySchedule ?? []).map((item: AnyRecord) => `${item.day} ${item.startTime}-${item.endTime}`).join("، "),
  })), columns, { total }, searchParams, buildPaginationMeta(total, pagination));
}

async function teacherEarningsReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  const teacherId = objectId(searchParams.get("teacherId"));
  const match: AnyRecord = { ...dateRange(searchParams) };
  if (teacherId) match.teacherId = teacherId;
  const rows = await TeacherLessonCompensation.aggregate([{ $match: match }, { $group: { _id: "$teacherId", earnings: { $sum: "$amountMinor" }, revenue: { $sum: "$revenueMinor" }, lessons: { $sum: 1 }, paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amountMinor", 0] } } } }, { $lookup: { from: "teachers", localField: "_id", foreignField: "_id", as: "teacher" } }, { $unwind: { path: "$teacher", preserveNullAndEmptyArrays: true } }, { $sort: { earnings: -1 } }, { $skip: pagination.skip }, { $limit: pagination.limit }]);
  const countRows = await TeacherLessonCompensation.aggregate([{ $match: match }, { $group: { _id: "$teacherId" } }, { $count: "total" }]);
  return reportBase(type, rows.map((row) => ({ teacher: row.teacher?.name ?? "", lessons: row.lessons, revenue: amount(row.revenue), earnings: amount(row.earnings), paid: amount(row.paid), outstanding: amount(row.earnings - row.paid) })), [{ key: "teacher", label: "الأستاذ" }, { key: "lessons", label: "الحصص" }, { key: "revenue", label: "الإيراد" }, { key: "earnings", label: "مستحق الأستاذ" }, { key: "paid", label: "المدفوع" }, { key: "outstanding", label: "المتبقي" }], { totalTeachers: countRows[0]?.total ?? 0, earnings: amount(rows.reduce((sum, row) => sum + row.earnings, 0)) }, searchParams, buildPaginationMeta(countRows[0]?.total ?? 0, pagination));
}

function paymentFilter(searchParams: URLSearchParams, chargeType?: string) {
  const filter: AnyRecord = { status: "completed", ...dateRange(searchParams, "paymentDate") };
  if (searchParams.get("academicSeason")) filter.academicSeason = searchParams.get("academicSeason");
  if (chargeType) filter.allocations = { $exists: true };
  return filter;
}

async function paymentsReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  const chargeTypeMap: Record<string, string> = {
    registration_fees: "registration",
    tuition_fees: "course",
    transportation_income: "transportation",
    other_income: "other",
  };
  const chargeType = chargeTypeMap[type];
  if (["daily_income", "weekly_income", "monthly_income", "yearly_income"].includes(type)) return incomeTrendReport(type, searchParams, pagination);
  if (type === "kindergarten_income") return kindergartenIncomeReport(searchParams, pagination);
  if (type === "private_lesson_income") return privateLessonsReport(type, searchParams, pagination);

  const filter = paymentFilter(searchParams, chargeType);
  const pipeline: mongoose.PipelineStage[] = [{ $match: filter }];
  if (chargeType) {
    pipeline.push({ $unwind: "$allocations" }, { $lookup: { from: "studentcharges", localField: "allocations.chargeId", foreignField: "_id", as: "charge" } }, { $unwind: "$charge" }, { $match: { "charge.chargeType": chargeType } });
  }
  const [rows, total, summary] = await Promise.all([
    StudentPayment.aggregate([...pipeline, { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "student" } }, { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } }, { $sort: { paymentDate: -1 } }, { $skip: pagination.skip }, { $limit: pagination.limit }]),
    StudentPayment.aggregate([...pipeline, { $count: "total" }]).then((r) => r[0]?.total ?? 0),
    StudentPayment.aggregate([...pipeline, { $group: { _id: "$paymentMethod", total: { $sum: chargeType ? "$allocations.amountMinor" : "$amountMinor" }, count: { $sum: 1 } } }]),
  ]);
  return reportBase(type, rows.map((row) => ({ student: row.student?.name ?? "", amount: amount(chargeType ? row.allocations?.amountMinor : row.amountMinor), method: row.paymentMethod, receipt: row.receiptNumber, date: formatDate(row.paymentDate) })), [{ key: "student", label: "الطالب" }, { key: "amount", label: "المبلغ" }, { key: "method", label: "الطريقة" }, { key: "receipt", label: "الوصل" }, { key: "date", label: "التاريخ" }], { total, collected: amount(summary.reduce((sum: number, row: AnyRecord) => sum + row.total, 0)) }, searchParams, buildPaginationMeta(total, pagination));
}

async function incomeTrendReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  const formats: Record<string, string> = { daily_income: "%Y-%m-%d", weekly_income: "%G-W%V", monthly_income: "%Y-%m", yearly_income: "%Y" };
  const rows = await StudentPayment.aggregate([{ $match: paymentFilter(searchParams) }, { $group: { _id: { $dateToString: { format: formats[type], date: "$paymentDate" } }, amount: { $sum: "$amountMinor" }, count: { $sum: 1 } } }, { $sort: { _id: -1 } }, { $skip: pagination.skip }, { $limit: pagination.limit }]);
  const countRows = await StudentPayment.aggregate([{ $match: paymentFilter(searchParams) }, { $group: { _id: { $dateToString: { format: formats[type], date: "$paymentDate" } } } }, { $count: "total" }]);
  return reportBase(type, rows.map((row) => ({ period: row._id, amount: amount(row.amount), payments: row.count })), [{ key: "period", label: "الفترة" }, { key: "amount", label: "الإيراد" }, { key: "payments", label: "عدد المدفوعات" }], { periods: countRows[0]?.total ?? 0, totalIncome: amount(rows.reduce((sum, row) => sum + row.amount, 0)) }, searchParams, buildPaginationMeta(countRows[0]?.total ?? 0, pagination));
}

async function financeReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  if (["finance_income", "payments", "receipts", "cash_flow", "registration_fees", "tuition_fees", "transportation_income", "other_income", "daily_income", "weekly_income", "monthly_income", "yearly_income", "kindergarten_income", "private_lesson_income"].includes(type)) {
    if (type === "cash_flow") return cashFlowReport(searchParams, pagination);
    return paymentsReport(type, searchParams, pagination);
  }
  if (type === "expenses") {
    const filter = dateRange(searchParams, "expenseDate");
    const [rows, total, summary] = await Promise.all([Expense.find(filter).sort({ expenseDate: -1 }).skip(pagination.skip).limit(pagination.limit).lean(), Expense.countDocuments(filter), Expense.aggregate([{ $match: filter }, { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } }])]);
    return reportBase(type, rows.map((row: AnyRecord) => ({ title: row.title, category: row.category, amount: row.amount, date: formatDate(row.expenseDate), paymentMethod: row.paymentMethod })), [{ key: "title", label: "المصروف" }, { key: "category", label: "الصنف" }, { key: "amount", label: "المبلغ" }, { key: "paymentMethod", label: "الدفع" }, { key: "date", label: "التاريخ" }], { total, expenses: summary.reduce((sum: number, row: AnyRecord) => sum + row.total, 0) }, searchParams, buildPaginationMeta(total, pagination));
  }
  if (type === "refunds") {
    const filter = dateRange(searchParams, "refundDate");
    const [rows, total, summary] = await Promise.all([StudentRefund.find(filter).populate("studentId", "name").sort({ refundDate: -1 }).skip(pagination.skip).limit(pagination.limit).lean(), StudentRefund.countDocuments(filter), StudentRefund.aggregate([{ $match: filter }, { $group: { _id: "$status", total: { $sum: "$refundAmountMinor" }, count: { $sum: 1 } } }])]);
    return reportBase(type, rows.map((row: AnyRecord) => ({ student: display(row.studentId), amount: amount(row.refundAmountMinor), reason: row.reason, status: row.status, date: formatDate(row.refundDate) })), [{ key: "student", label: "الطالب" }, { key: "amount", label: "المبلغ" }, { key: "reason", label: "السبب" }, { key: "status", label: "الحالة" }, { key: "date", label: "التاريخ" }], { total, refunds: amount(summary.reduce((sum: number, row: AnyRecord) => sum + row.total, 0)) }, searchParams, buildPaginationMeta(total, pagination));
  }
  if (type === "net_profit") {
    const [income, expenses, refunds] = await Promise.all([
      StudentPayment.aggregate([{ $match: paymentFilter(searchParams) }, { $group: { _id: null, total: { $sum: "$amountMinor" } } }]),
      Expense.aggregate([{ $match: dateRange(searchParams, "expenseDate") }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      StudentRefund.aggregate([{ $match: dateRange(searchParams, "refundDate") }, { $group: { _id: null, total: { $sum: "$refundAmountMinor" } } }]),
    ]);
    const totalIncome = amount(income[0]?.total);
    const totalExpenses = expenses[0]?.total ?? 0;
    const totalRefunds = amount(refunds[0]?.total);
    return reportBase(type, [{ name: "الدخل", amount: totalIncome }, { name: "المصاريف", amount: totalExpenses }, { name: "الاسترجاعات", amount: totalRefunds }, { name: "صافي الربح", amount: totalIncome - totalExpenses - totalRefunds }], [{ key: "name", label: "البند" }, { key: "amount", label: "المبلغ" }], { income: totalIncome, expenses: totalExpenses, refunds: totalRefunds, netProfit: totalIncome - totalExpenses - totalRefunds }, searchParams);
  }
  return outstandingReport(type, searchParams, pagination);
}

async function cashFlowReport(searchParams: URLSearchParams, pagination: PaginationParams) {
  const [payments, expenses, refunds] = await Promise.all([
    StudentPayment.aggregate([{ $match: paymentFilter(searchParams) }, { $project: { date: "$paymentDate", type: "دخل", description: "$receiptNumber", amount: { $divide: ["$amountMinor", 100] } } }]),
    Expense.aggregate([{ $match: dateRange(searchParams, "expenseDate") }, { $project: { date: "$expenseDate", type: "مصروف", description: "$title", amount: { $multiply: ["$amount", -1] } } }]),
    StudentRefund.aggregate([{ $match: dateRange(searchParams, "refundDate") }, { $project: { date: "$refundDate", type: "استرجاع", description: "$reason", amount: { $multiply: [{ $divide: ["$refundAmountMinor", 100] }, -1] } } }]),
  ]);
  const merged = [...payments, ...expenses, ...refunds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const rows = merged.slice(pagination.skip, pagination.skip + pagination.limit).map((row) => ({ ...row, date: formatDate(row.date) }));
  const net = merged.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return reportBase("cash_flow", rows, [{ key: "date", label: "التاريخ" }, { key: "type", label: "النوع" }, { key: "description", label: "الوصف" }, { key: "amount", label: "المبلغ" }], { operations: merged.length, netCashFlow: Math.round(net) }, searchParams, buildPaginationMeta(merged.length, pagination));
}

async function attendanceReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  const filter: AnyRecord = { ...dateRange(searchParams, "date") };
  if (searchParams.get("academicSeason")) filter.academicSeason = searchParams.get("academicSeason");
  if (searchParams.get("academicLevel")) filter.academicLevel = searchParams.get("academicLevel");
  if (searchParams.get("className")) filter.className = searchParams.get("className");
  if (searchParams.get("attendanceStatus")) filter.status = searchParams.get("attendanceStatus");
  const teacherId = objectId(searchParams.get("teacherId"));
  const courseId = objectId(searchParams.get("courseId"));
  if (teacherId) filter.teacherId = teacherId;
  if (courseId) filter.courseId = courseId;
  if (type === "attendance_by_kindergarten") filter.contextType = "kindergarten";

  if (["attendance_summary", "monthly_attendance", "attendance_by_class", "attendance_by_teacher", "attendance_by_course", "attendance_by_kindergarten"].includes(type)) {
    const groupId = type === "monthly_attendance" ? { $dateToString: { format: "%Y-%m", date: "$date" } } : type === "attendance_by_class" ? "$className" : type === "attendance_by_teacher" ? "$teacherId" : type === "attendance_by_course" ? "$courseId" : type === "attendance_by_kindergarten" ? "$className" : "$status";
    const rows = await StudentAttendance.aggregate([{ $match: filter }, { $group: { _id: groupId, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } }, late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } } } }, { $sort: { total: -1 } }, { $skip: pagination.skip }, { $limit: pagination.limit }]);
    const totalRows = await StudentAttendance.aggregate([{ $match: filter }, { $group: { _id: groupId } }, { $count: "total" }]);
    return reportBase(type, rows.map((row) => ({ group: display(row._id) || "غير محدد", total: row.total, present: row.present, absent: row.absent, late: row.late, attendancePercentage: row.total ? Math.round((row.present / row.total) * 100) : 0, absencePercentage: row.total ? Math.round((row.absent / row.total) * 100) : 0, latePercentage: row.total ? Math.round((row.late / row.total) * 100) : 0 })), [{ key: "group", label: "التصنيف" }, { key: "total", label: "الإجمالي" }, { key: "present", label: "حضور" }, { key: "absent", label: "غياب" }, { key: "late", label: "تأخر" }, { key: "attendancePercentage", label: "نسبة الحضور %" }, { key: "absencePercentage", label: "نسبة الغياب %" }, { key: "latePercentage", label: "نسبة التأخر %" }], { groups: totalRows[0]?.total ?? 0 }, searchParams, buildPaginationMeta(totalRows[0]?.total ?? 0, pagination));
  }

  const [rows, total, summary] = await Promise.all([
    StudentAttendance.find(filter).populate("studentId", "name").populate("teacherId", "name").populate("courseId", "title").sort({ date: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    StudentAttendance.countDocuments(filter),
    StudentAttendance.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  return reportBase(type, rows.map((row: AnyRecord) => ({ student: display(row.studentId), teacher: display(row.teacherId), course: display(row.courseId), status: row.status, context: row.contextType, className: row.className, date: formatDate(row.date) })), [{ key: "student", label: "الطالب" }, { key: "status", label: "الحالة" }, { key: "teacher", label: "الأستاذ" }, { key: "course", label: "الدورة" }, { key: "className", label: "القسم" }, { key: "date", label: "التاريخ" }], { total, ...Object.fromEntries(summary.map((row: AnyRecord) => [String(row._id || "unknown"), row.count])) }, searchParams, buildPaginationMeta(total, pagination));
}

async function privateLessonsReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  const filter: AnyRecord = { deletedAt: null, ...dateRange(searchParams, "lessonDate") };
  const teacherId = objectId(searchParams.get("teacherId"));
  if (teacherId) filter.teacherId = teacherId;
  if (searchParams.get("academicLevel")) filter.academicLevel = searchParams.get("academicLevel");
  if (searchParams.get("academicSeason")) filter.academicSeason = searchParams.get("academicSeason");
  if (searchParams.get("paymentStatus")) filter.paymentStatus = searchParams.get("paymentStatus");
  if (type === "private_lesson_income") filter.paymentStatus = { $in: ["paid", "partially_paid"] };
  const [rows, total, summary] = await Promise.all([
    PrivateLesson.find(filter).populate("teacherId", "name").sort({ lessonDate: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    PrivateLesson.countDocuments(filter),
    PrivateLesson.aggregate([{ $match: filter }, { $group: { _id: "$paymentStatus", revenue: { $sum: "$pricing.finalAmountMinor" }, teacherEarnings: { $sum: "$compensation.amountMinor" }, count: { $sum: 1 } } }]),
  ]);
  return reportBase(type, rows.map((row: AnyRecord) => ({ students: (row.students ?? []).map((student: AnyRecord) => `${student.name} (${student.attendanceStatus})`).join("، "), teacher: display(row.teacherId), subject: row.subject, price: amount(row.pricing?.finalAmountMinor), teacherEarnings: amount(row.compensation?.amountMinor), paymentStatus: row.paymentStatus, status: row.status, attendance: row.studentAttendanceStatus, date: formatDate(row.lessonDate) })), [{ key: "students", label: "الطلاب" }, { key: "teacher", label: "الأستاذ" }, { key: "subject", label: "المادة" }, { key: "price", label: "الإيراد" }, { key: "teacherEarnings", label: "مستحق الأستاذ" }, { key: "paymentStatus", label: "الدفع" }, { key: "attendance", label: "الحضور" }, { key: "date", label: "التاريخ" }], { total, revenue: amount(summary.reduce((sum: number, row: AnyRecord) => sum + row.revenue, 0)), teacherEarnings: amount(summary.reduce((sum: number, row: AnyRecord) => sum + row.teacherEarnings, 0)), paidLessons: summary.find((row: AnyRecord) => row._id === "paid")?.count ?? 0, unpaidLessons: summary.find((row: AnyRecord) => row._id === "unpaid")?.count ?? 0 }, searchParams, buildPaginationMeta(total, pagination));
}

async function kindergartenIncomeReport(searchParams: URLSearchParams, pagination: PaginationParams) {
  const filter: AnyRecord = { deletedAt: null };
  Object.assign(filter, dateRange(searchParams, "payments.paymentDate"));
  const rows = await KindergartenRegistration.aggregate([{ $match: filter }, { $unwind: "$payments" }, { $match: { "payments.cancelledAt": { $exists: false } } }, { $sort: { "payments.paymentDate": -1 } }, { $skip: pagination.skip }, { $limit: pagination.limit }]);
  const summary = await KindergartenRegistration.aggregate([{ $match: { deletedAt: null } }, { $unwind: "$payments" }, { $match: { "payments.cancelledAt": { $exists: false } } }, { $group: { _id: "$payments.paymentType", total: { $sum: "$payments.amountMinor" }, count: { $sum: 1 } } }]);
  const total = summary.reduce((sum: number, row: AnyRecord) => sum + row.count, 0);
  return reportBase("kindergarten_income", rows.map((row) => ({ child: row.childName, paymentType: row.payments.paymentType, amount: amount(row.payments.amountMinor), receipt: row.payments.receiptNumber, date: formatDate(row.payments.paymentDate) })), [{ key: "child", label: "الطفل" }, { key: "paymentType", label: "نوع الدفع" }, { key: "amount", label: "المبلغ" }, { key: "receipt", label: "الوصل" }, { key: "date", label: "التاريخ" }], { total, income: amount(summary.reduce((sum: number, row: AnyRecord) => sum + row.total, 0)) }, searchParams, buildPaginationMeta(total, pagination));
}

async function kindergartenReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  if (type === "kindergarten_income") return kindergartenIncomeReport(searchParams, pagination);
  const filter: AnyRecord = { deletedAt: null, ...dateRange(searchParams, "registrationDate") };
  if (searchParams.get("teacherId")) filter.teacherId = objectId(searchParams.get("teacherId")) ?? searchParams.get("teacherId");
  if (searchParams.get("group")) filter.groupName = searchParams.get("group");
  if (searchParams.get("paymentStatus")) filter.subscriptionPaymentStatus = searchParams.get("paymentStatus");
  const [rows, total, summary] = await Promise.all([
    KindergartenRegistration.find(filter).populate("teacherId", "name").sort({ registrationDate: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    KindergartenRegistration.countDocuments(filter),
    KindergartenRegistration.aggregate([{ $match: filter }, { $group: { _id: "$subscriptionType", registration: { $sum: "$registrationPaidMinor" }, subscription: { $sum: "$subscriptionPaidMinor" }, outstanding: { $sum: "$totalOutstandingMinor" }, count: { $sum: 1 } } }]),
  ]);
  return reportBase(type, rows.map((row: AnyRecord) => ({ child: row.childName, guardian: row.guardianPhone, teacher: display(row.teacherId), group: row.groupName, type: row.subscriptionType, registrationPaid: amount(row.registrationPaidMinor), subscriptionPaid: amount(row.subscriptionPaidMinor), outstanding: amount(row.totalOutstandingMinor), status: row.status })), [{ key: "child", label: "الطفل" }, { key: "guardian", label: "الولي" }, { key: "teacher", label: "المربية" }, { key: "group", label: "الفوج" }, { key: "type", label: "الاشتراك" }, { key: "registrationPaid", label: "رسوم التسجيل" }, { key: "subscriptionPaid", label: "الاشتراك" }, { key: "outstanding", label: "المتبقي" }, { key: "status", label: "الحالة" }], { total, activeChildren: rows.filter((row: AnyRecord) => row.status === "active").length, income: amount(summary.reduce((sum: number, row: AnyRecord) => sum + row.registration + row.subscription, 0)), outstanding: amount(summary.reduce((sum: number, row: AnyRecord) => sum + row.outstanding, 0)) }, searchParams, buildPaginationMeta(total, pagination));
}

async function transportationReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  const filter: AnyRecord = {};
  Object.assign(filter, dateRange(searchParams, "startDate"));
  if (searchParams.get("studentStatus")) filter.status = searchParams.get("studentStatus");
  const [rows, total] = await Promise.all([
    TransportSubscription.find(filter).populate("studentId", "name phone academicLevel className").populate("busId", "name plateNumber").sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    TransportSubscription.countDocuments(filter),
  ]);
  return reportBase(type, rows.map((row: AnyRecord) => ({ student: display(row.studentId), bus: row.busId?.name || row.busId?.plateNumber || "", pickup: row.pickupPoint, dropoff: row.dropoffPoint, status: row.status, startDate: formatDate(row.startDate), endDate: formatDate(row.endDate) })), [{ key: "student", label: "الطالب" }, { key: "bus", label: "الحافلة" }, { key: "pickup", label: "نقطة الصعود" }, { key: "dropoff", label: "نقطة النزول" }, { key: "status", label: "الحالة" }, { key: "startDate", label: "البداية" }, { key: "endDate", label: "النهاية" }], { total }, searchParams, buildPaginationMeta(total, pagination));
}

async function rolloverReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  if (type === "season_comparison") {
    const seasons = await AcademicSeason.find({}).sort({ startDate: -1 }).limit(12).lean();
    const rows = await Promise.all(seasons.map(async (season) => {
      const [students, revenue, outstanding] = await Promise.all([
        User.countDocuments({ role: "student", academicSeason: season.code }),
        StudentPayment.aggregate([{ $match: { academicSeason: season.code, status: "completed" } }, { $group: { _id: null, total: { $sum: "$amountMinor" } } }]),
        StudentCharge.aggregate([{ $match: { academicSeason: season.code, balanceMinor: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: "$balanceMinor" } } }]),
      ]);
      return { season: season.code, status: season.status, students, revenue: amount(revenue[0]?.total), outstanding: amount(outstanding[0]?.total) };
    }));
    return reportBase(type, rows, [{ key: "season", label: "الموسم" }, { key: "status", label: "الحالة" }, { key: "students", label: "الطلاب" }, { key: "revenue", label: "الإيرادات" }, { key: "outstanding", label: "الأرصدة" }], { seasons: rows.length }, searchParams);
  }
  if (type === "financial_carry_forward") {
    const filter: AnyRecord = { relatedRecordType: "season_opening_balance" };
    if (searchParams.get("academicSeason")) filter.academicSeason = searchParams.get("academicSeason");
    const [rows, total, summary] = await Promise.all([
      StudentCharge.find(filter).populate("studentId", "name").sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      StudentCharge.countDocuments(filter),
      StudentCharge.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: "$balanceMinor" }, count: { $sum: 1 } } }]),
    ]);
    return reportBase(type, rows.map((row: AnyRecord) => ({ student: display(row.studentId), season: row.academicSeason, amount: amount(row.balanceMinor), reason: row.notes, createdAt: formatDate(row.createdAt) })), [{ key: "student", label: "الطالب" }, { key: "season", label: "الموسم" }, { key: "amount", label: "المبلغ" }, { key: "reason", label: "السبب" }, { key: "createdAt", label: "التاريخ" }], { total, amount: amount(summary[0]?.total) }, searchParams, buildPaginationMeta(total, pagination));
  }
  const actionMap: Record<string, string> = {
    promoted_students: "promote",
    repeating_students: "repeat",
    transferred_students: "transfer",
    rollover_graduated_students: "graduate",
    rollover_withdrawn_students: "withdraw",
    rollover_archived_students: "archive",
  };
  const statusMap: Record<string, string> = { failed_rollover_items: "failed" };
  const match: AnyRecord = {};
  if (searchParams.get("academicSeason")) match.targetSeason = searchParams.get("academicSeason");
  const itemMatch: AnyRecord = {};
  if (actionMap[type]) itemMatch["items.action"] = actionMap[type];
  if (statusMap[type]) itemMatch["items.status"] = statusMap[type];
  if (type === "transportation_rollover") itemMatch["items.warnings.code"] = "duplicate_transportation_assignment";
  if (type === "kindergarten_rollover") itemMatch["items.warnings.code"] = "duplicate_kindergarten_registration";
  const pipeline: mongoose.PipelineStage[] = [{ $match: match }, { $unwind: "$items" }];
  if (Object.keys(itemMatch).length) pipeline.push({ $match: itemMatch });
  if (type === "rollover_conflicts") pipeline.push({ $match: { $or: [{ "items.conflicts.0": { $exists: true } }, { "items.warnings.0": { $exists: true } }] } });
  const [rows, countRows] = await Promise.all([
    RolloverJob.aggregate([...pipeline, { $sort: { updatedAt: -1 } }, { $skip: pagination.skip }, { $limit: pagination.limit }]),
    RolloverJob.aggregate([...pipeline, { $count: "total" }]),
  ]);
  const total = countRows[0]?.total ?? 0;
  return reportBase(type, rows.map((row: AnyRecord) => ({
    job: row._id?.toString?.() ?? "",
    sourceSeason: row.sourceSeason,
    targetSeason: row.targetSeason,
    student: row.items?.preview?.studentName ?? row.items?.studentId?.toString?.(),
    action: row.items?.action,
    status: row.items?.status,
    conflicts: [...(row.items?.conflicts ?? []), ...(row.items?.warnings ?? [])].map((item: AnyRecord) => item.message).join("، "),
    executedAt: formatDate(row.items?.executedAt),
  })), [{ key: "job", label: "المهمة" }, { key: "sourceSeason", label: "المصدر" }, { key: "targetSeason", label: "الهدف" }, { key: "student", label: "الطالب" }, { key: "action", label: "الإجراء" }, { key: "status", label: "الحالة" }, { key: "conflicts", label: "التعارضات/التحذيرات" }, { key: "executedAt", label: "تاريخ التنفيذ" }], { total }, searchParams, buildPaginationMeta(total, pagination));
}

async function genericReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams): Promise<ReportResult> {
  if (["rollover_students", "promoted_students", "repeating_students", "transferred_students", "rollover_graduated_students", "rollover_withdrawn_students", "rollover_archived_students", "failed_rollover_items", "rollover_conflicts", "financial_carry_forward", "transportation_rollover", "kindergarten_rollover", "season_comparison"].includes(type)) return rolloverReport(type, searchParams, pagination);
  if (type.startsWith("teacher_") || type === "teachers") return teachersReport(type, searchParams, pagination);
  if (["finance_income", "payments", "receipts", "cash_flow", "registration_fees", "tuition_fees", "transportation_income", "other_income", "daily_income", "weekly_income", "monthly_income", "yearly_income", "expenses", "net_profit", "debts", "refunds"].includes(type)) return financeReport(type, searchParams, pagination);
  if (type.includes("attendance") || type === "student_attendance") return attendanceReport(type, searchParams, pagination);
  if (type.startsWith("private_lesson") || type === "private_lessons") return privateLessonsReport(type, searchParams, pagination);
  if (type.startsWith("kindergarten")) return kindergartenReport(type, searchParams, pagination);
  if (type === "transportation" || type === "students_by_transportation") return transportationReport(type, searchParams, pagination);
  if (type === "courses") {
    const filter: AnyRecord = { deletedAt: null };
    if (searchParams.get("academicLevel")) filter.level = searchParams.get("academicLevel");
    if (searchParams.get("teacherId")) filter.teacher = objectId(searchParams.get("teacherId")) ?? searchParams.get("teacherId");
    const { rows, total } = await paged(Course.find(filter).populate("teacher", "name").sort({ createdAt: -1 }), Course.countDocuments(filter), pagination);
    return reportBase(type, rows.map((row) => ({ title: row.title, teacher: display(row.teacher), department: row.department, level: row.level, price: row.price, seats: row.seats, remainingSeats: row.remainingSeats })), [{ key: "title", label: "الدورة" }, { key: "teacher", label: "الأستاذ" }, { key: "department", label: "القسم" }, { key: "level", label: "المستوى" }, { key: "price", label: "السعر" }, { key: "seats", label: "المقاعد" }, { key: "remainingSeats", label: "المتبقي" }], { total }, searchParams, buildPaginationMeta(total, pagination));
  }
  if (type === "enrollments") {
    const filter: AnyRecord = { ...dateRange(searchParams) };
    if (searchParams.get("paymentStatus")) filter.status = searchParams.get("paymentStatus");
    if (searchParams.get("courseId")) filter.course = objectId(searchParams.get("courseId")) ?? searchParams.get("courseId");
    const { rows, total } = await paged(Enrollment.find(filter).populate("student", "name phone").populate("course", "title").sort({ createdAt: -1 }), Enrollment.countDocuments(filter), pagination);
    return reportBase(type, rows.map((row) => ({ student: display(row.student), course: display(row.course), status: row.status, note: row.note, date: formatDate(row.createdAt) })), [{ key: "student", label: "الطالب" }, { key: "course", label: "الدورة" }, { key: "status", label: "الحالة" }, { key: "note", label: "ملاحظة" }, { key: "date", label: "التاريخ" }], { total }, searchParams, buildPaginationMeta(total, pagination));
  }
  if (type === "academic_performance") {
    const filter: AnyRecord = { ...dateRange(searchParams) };
    if (searchParams.get("academicSeason")) filter.academicSeason = searchParams.get("academicSeason");
    if (searchParams.get("teacherId")) filter.teacherId = objectId(searchParams.get("teacherId")) ?? searchParams.get("teacherId");
    const { rows, total } = await paged(StudentPerformance.find(filter).populate("studentId", "name").populate("teacherId", "name").sort({ createdAt: -1 }), StudentPerformance.countDocuments(filter), pagination);
    return reportBase(type, rows.map((row) => ({ student: display(row.studentId), teacher: display(row.teacherId), subject: row.subject, type: row.type, score: `${row.score}/${row.maxScore}`, percentage: Math.round((Number(row.score) / Number(row.maxScore || 1)) * 100), period: row.academicPeriod })), [{ key: "student", label: "الطالب" }, { key: "teacher", label: "الأستاذ" }, { key: "subject", label: "المادة" }, { key: "type", label: "النوع" }, { key: "score", label: "النقطة" }, { key: "percentage", label: "النسبة %" }, { key: "period", label: "الفترة" }], { total }, searchParams, buildPaginationMeta(total, pagination));
  }
  if (type === "invoices") {
    const filter: AnyRecord = {};
    if (searchParams.get("academicSeason")) filter.academicSeason = searchParams.get("academicSeason");
    if (searchParams.get("paymentStatus")) filter.paymentStatus = searchParams.get("paymentStatus");
    const { rows, total } = await paged(TeacherPayout.find(filter).populate("teacherId", "name").populate("courseId", "title").sort({ createdAt: -1 }), TeacherPayout.countDocuments(filter), pagination);
    return reportBase(type, rows.map((row) => ({ teacher: display(row.teacherId), course: display(row.courseId), amount: row.totalDue || row.amount, paid: row.paid, remaining: row.remaining, status: row.paymentStatus || row.status, date: formatDate(row.payoutDate) })), [{ key: "teacher", label: "الأستاذ" }, { key: "course", label: "الدورة" }, { key: "amount", label: "المبلغ" }, { key: "paid", label: "المدفوع" }, { key: "remaining", label: "المتبقي" }, { key: "status", label: "الحالة" }, { key: "date", label: "التاريخ" }], { total }, searchParams, buildPaginationMeta(total, pagination));
  }
  if (type === "audit_logs") {
    const [audit, financial] = await Promise.all([AuditLog.find(dateRange(searchParams)).sort({ createdAt: -1 }).limit(1000).lean(), FinancialAuditLog.find(dateRange(searchParams)).sort({ createdAt: -1 }).limit(1000).lean()]);
    const merged = [...audit, ...financial].sort((a: AnyRecord, b: AnyRecord) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return reportBase(type, merged.slice(pagination.skip, pagination.skip + pagination.limit).map((row: AnyRecord) => ({ action: row.action, entity: row.entityType || row.recordType || row.entity, user: display(row.userId || row.createdBy), date: formatDate(row.createdAt) })), [{ key: "action", label: "الإجراء" }, { key: "entity", label: "الكيان" }, { key: "user", label: "المستخدم" }, { key: "date", label: "التاريخ" }], { total: merged.length }, searchParams, buildPaginationMeta(merged.length, pagination));
  }
  return studentReport("students", searchParams, pagination);
}

export async function buildDashboardAnalytics(searchParams = new URLSearchParams()) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [students, newRegistrations, teachers, revenue, outstanding, attendance, expenses, privateLessons, kindergarten, trends] = await Promise.all([
    User.countDocuments({ role: "student", deletedAt: null }),
    User.countDocuments({ role: "student", deletedAt: null, createdAt: { $gte: monthStart } }),
    Teacher.countDocuments({ deletedAt: null, status: "active" }),
    StudentPayment.aggregate([{ $match: { status: "completed", ...dateRange(searchParams, "paymentDate") } }, { $group: { _id: null, total: { $sum: "$amountMinor" } } }]),
    StudentCharge.aggregate([{ $match: { balanceMinor: { $gt: 0 }, status: { $nin: ["cancelled", "paid", "exempted"] } } }, { $group: { _id: null, total: { $sum: "$balanceMinor" } } }]),
    StudentAttendance.aggregate([{ $match: dateRange(searchParams, "date") }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Expense.aggregate([{ $match: dateRange(searchParams, "expenseDate") }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    PrivateLesson.countDocuments({ deletedAt: null, ...dateRange(searchParams, "lessonDate") }),
    KindergartenRegistration.countDocuments({ deletedAt: null, status: "active" }),
    StudentPayment.aggregate([{ $match: { status: "completed" } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate" } }, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } }, { $sort: { _id: -1 } }, { $limit: 6 }]),
  ]);
  const attendanceTotal = attendance.reduce((sum: number, row: AnyRecord) => sum + row.count, 0);
  const present = attendance.find((row: AnyRecord) => row._id === "present")?.count ?? 0;
  return {
    kpis: {
      students,
      newRegistrations,
      activeTeachers: teachers,
      revenue: amount(revenue[0]?.total),
      expenses: expenses[0]?.total ?? 0,
      netRevenue: amount(revenue[0]?.total) - (expenses[0]?.total ?? 0),
      outstanding: amount(outstanding[0]?.total),
      attendancePercentage: attendanceTotal ? Math.round((present / attendanceTotal) * 100) : 0,
      privateLessons,
      kindergarten,
    },
    attendance: Object.fromEntries(attendance.map((row: AnyRecord) => [row._id || "unknown", row.count])),
    trends: trends.reverse().map((row: AnyRecord) => ({ period: row._id, revenue: amount(row.total), payments: row.count })),
  };
}

async function communicationReport(type: string, searchParams: URLSearchParams, pagination: PaginationParams) {
  const baseFilter: AnyRecord = { ...dateRange(searchParams, "createdAt") };
  if (searchParams.get("channel")) baseFilter.channel = searchParams.get("channel");
  if (searchParams.get("category")) baseFilter.category = searchParams.get("category");
  if (searchParams.get("status")) baseFilter.status = searchParams.get("status");
  if (searchParams.get("academicSeason")) baseFilter["related.academicSeason"] = searchParams.get("academicSeason");

  if (type === "communications_by_channel" || type === "communications_by_category") {
    const groupField = type === "communications_by_channel" ? "$channel" : "$category";
    const rows = await Communication.aggregate([
      { $match: baseFilter },
      { $group: { _id: groupField, total: { $sum: 1 }, recipients: { $sum: "$recipientCount" }, failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } } } },
      { $sort: { total: -1 } },
    ]);
    return reportBase(type, rows.map((row: AnyRecord) => ({ name: row._id || "unknown", total: row.total, recipients: row.recipients, failed: row.failed })), [{ key: "name", label: "Name" }, { key: "total", label: "Total" }, { key: "recipients", label: "Recipients" }, { key: "failed", label: "Failed" }], { total: rows.reduce((sum: number, row: AnyRecord) => sum + row.total, 0) }, searchParams);
  }

  if (type === "communication_delivery_rate" || type === "communication_failure_rate" || type === "provider_performance") {
    const rows = await CommunicationDelivery.aggregate([
      { $match: searchParams.get("channel") ? { channel: searchParams.get("channel") } : {} },
      { $group: { _id: type === "provider_performance" ? "$provider" : "$status", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    const total = rows.reduce((sum: number, row: AnyRecord) => sum + row.total, 0);
    return reportBase(type, rows.map((row: AnyRecord) => ({ status: row._id || "unknown", total: row.total, percentage: total ? Math.round((row.total / total) * 100) : 0 })), [{ key: "status", label: "Status" }, { key: "total", label: "Total" }, { key: "percentage", label: "Percentage" }], { total }, searchParams);
  }

  if (type === "communication_opt_out_statistics") {
    const rows = await CommunicationPreference.aggregate([{ $group: { _id: "$ownerType", total: { $sum: 1 }, optedOut: { $sum: { $cond: ["$optedOut", 1, 0] } } } }, { $sort: { total: -1 } }]);
    return reportBase(type, rows.map((row: AnyRecord) => ({ ownerType: row._id, total: row.total, optedOut: row.optedOut })), [{ key: "ownerType", label: "Owner type" }, { key: "total", label: "Total" }, { key: "optedOut", label: "Opted out" }], { total: rows.reduce((sum: number, row: AnyRecord) => sum + row.total, 0) }, searchParams);
  }

  const listFilter: AnyRecord = { ...baseFilter };
  if (type === "pending_communications") listFilter.status = { $in: ["draft", "scheduled", "queued", "processing"] };
  if (type === "scheduled_communications") listFilter.status = "scheduled";
  if (type === "attendance_alerts_report") listFilter.category = { $in: ["attendance_absence", "attendance_lateness", "attendance"] };
  if (type === "payment_reminders_report") listFilter.category = { $in: ["payment_due", "payment_overdue", "payment_reminder"] };
  if (type === "bulk_communication_results") listFilter.recipientCount = { $gt: 1 };
  const [rows, total] = await Promise.all([
    Communication.find(listFilter).sort({ createdAt: -1 }).skip((pagination.page - 1) * pagination.limit).limit(pagination.limit).lean(),
    Communication.countDocuments(listFilter),
  ]);
  return reportBase(
    type,
    rows.map((row: AnyRecord) => ({ subject: row.subject || row.content, channel: row.channel, category: row.category, status: row.status, recipients: row.recipientCount, failed: row.errorSummary || "", createdAt: formatDate(row.createdAt) })),
    [{ key: "subject", label: "Subject" }, { key: "channel", label: "Channel" }, { key: "category", label: "Category" }, { key: "status", label: "Status" }, { key: "recipients", label: "Recipients" }, { key: "failed", label: "Failure" }, { key: "createdAt", label: "Created" }],
    { total },
    searchParams,
    buildPaginationMeta(total, pagination)
  );
}

export async function buildReport(type: string, searchParams: URLSearchParams): Promise<ReportResult> {
  const exportMode = searchParams.get("export");
  const pagination = parsePagination(searchParams, exportMode ? 100 : 25);
  if (type === "dashboard_analytics") {
    const analytics = await buildDashboardAnalytics(searchParams);
    return reportBase(type, Object.entries(analytics.kpis).map(([name, value]) => ({ name, value })), [{ key: "name", label: "المؤشر" }, { key: "value", label: "القيمة" }], analytics.kpis, searchParams);
  }
  if (type.startsWith("communication") || ["communications_sent", "communications_by_channel", "communications_by_category", "pending_communications", "scheduled_communications", "attendance_alerts_report", "payment_reminders_report", "bulk_communication_results", "provider_performance"].includes(type)) {
    return communicationReport(type, searchParams, pagination);
  }
  if (type.startsWith("student") || ["active_students", "suspended_students", "graduated_students", "archived_students", "new_registrations", "medical_students", "outstanding_balances"].includes(type)) {
    return studentReport(type, searchParams, pagination);
  }
  return genericReport(type, searchParams, pagination);
}

function rowsForExport(report: ReportResult) {
  return report.rows.map((row) => report.columns.map((column) => display(row[column.key])));
}

export function reportCsvResponse(report: ReportResult) {
  return csvResponse(`${report.key}.csv`, toCsv(report.columns.map((column) => column.label), rowsForExport(report)));
}

export function reportExcelResponse(report: ReportResult) {
  const headers = report.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const rows = report.rows.map((row) => `<tr>${report.columns.map((column) => `<td>${escapeHtml(display(row[column.key]))}</td>`).join("")}</tr>`).join("");
  const summary = Object.entries(report.summary).map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /></head><body><h1>${escapeHtml(report.title)}</h1><table border="1"><tbody>${summary}</tbody></table><table border="1"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.key}.xls"`,
    },
  });
}

function printHtml(report: ReportResult, academy: Awaited<ReturnType<typeof getReceiptAcademyInfo>>, userName?: string) {
  const headers = report.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const rows = report.rows.map((row) => `<tr>${report.columns.map((column) => `<td>${escapeHtml(display(row[column.key]))}</td>`).join("")}</tr>`).join("");
  const summary = Object.entries(report.summary).map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const filters = Object.entries(report.filters).map(([key, value]) => `<span>${escapeHtml(key)}: ${escapeHtml(value)}</span>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>${escapeHtml(report.title)}</title><style>
    @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#111827;direction:rtl}.toolbar{margin:0 0 12px}.toolbar button{border:1px solid #d1d5db;background:#fff;padding:8px 12px;border-radius:6px}header{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:16px}.logo{width:58px;height:58px;border-radius:12px;background:#be185d;color:#fff;display:grid;place-items:center;font-weight:800}.muted{color:#6b7280;font-size:12px}.meta,.summary,.filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.meta div,.summary div,.filters span{border:1px solid #e5e7eb;border-radius:8px;padding:8px;font-size:12px}.summary span{display:block;color:#6b7280;margin-bottom:4px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #d1d5db;padding:7px;text-align:right;vertical-align:top}th{background:#f3f4f6}.signatures{display:flex;justify-content:space-between;gap:48px;margin-top:28px}.sig{border-top:1px solid #9ca3af;padding-top:8px;min-width:180px;text-align:center;font-size:12px}.page-number:after{content:counter(page)}@media print{.toolbar{display:none}.page-break{break-after:page}}</style></head><body>
    <div class="toolbar"><button onclick="window.print()">طباعة</button></div>
    <header><div><h1>${escapeHtml(academy.name)}</h1><p class="muted">${escapeHtml(academy.address)} - ${escapeHtml(academy.phone)}</p></div><div class="logo">هـ</div></header>
    <h2>${escapeHtml(report.title)}</h2>
    <section class="meta"><div>تاريخ الإنشاء<br><strong>${new Date(report.generatedAt).toLocaleString("ar-DZ")}</strong></div><div>المستخدم<br><strong>${escapeHtml(userName || "النظام")}</strong></div><div>عدد السجلات<br><strong>${report.pagination?.total ?? report.rows.length}</strong></div><div>الصفحة<br><strong class="page-number"></strong></div></section>
    <section class="filters">${filters || "<span>لا توجد فلاتر</span>"}</section>
    <section class="summary">${summary}</section>
    <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
    <section class="signatures"><div class="sig">إعداد</div><div class="sig">مراجعة الإدارة</div><div class="sig">الختم والتوقيع</div></section>
    <script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));</script>
  </body></html>`;
}

export async function reportPdfResponse(report: ReportResult) {
  const fields = [
    ...Object.entries(report.summary).map(([label, value]) => ({ label, value })),
    ...report.rows.slice(0, 20).flatMap((row, index) => [{ label: `السطر ${index + 1}`, value: report.columns.map((column) => `${column.label}: ${display(row[column.key])}`).join(" | ") }]),
  ];
  const pdf = await receiptPdf({ title: report.title, receiptNumber: `REPORT-${report.key}-${Date.now()}`, fields });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.key}.pdf"`,
    },
  });
}

export async function reportPrintResponse(report: ReportResult, userName?: string) {
  const academy = await getReceiptAcademyInfo();
  return new Response(printHtml(report, academy, userName), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

