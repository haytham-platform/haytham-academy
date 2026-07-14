import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { hasPermission, type Permission } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { getTeacherDashboardData, getTeacherReports, getTeacherSchedule, getTeacherStudents } from "@/lib/teacher-dashboard";
import { getParentAttendance, getParentChildren, getParentCommunications, getParentFinance, getParentKindergarten, getParentPrivateLessons, getParentTransportation } from "@/lib/parent-portal";
import { getStudentAttendance, getStudentCourses, getStudentFinance, getStudentGrades, getStudentPrivateLessons, getStudentProfile, getStudentSchedule } from "@/lib/student-portal";
import { minorToAmount } from "@/lib/student-finance";
import AIConversation, { type AIConversationScope } from "@/models/AIConversation";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Enrollment from "@/models/Enrollment";
import Course from "@/models/Course";
import KindergartenRegistration from "@/models/Kindergarten";
import { PrivateLesson } from "@/models/PrivateLesson";
import { StudentAttendance } from "@/models/StudentRecords";
import { StudentCharge, StudentPayment } from "@/models/StudentFinance";

type AnyRecord = Record<string, unknown>;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateLimit = new Map<string, { count: number; resetAt: number }>();

export class AIPlatformError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function idOf(value: unknown) {
  if (!value) return "";
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object" && value !== null && "_id" in value) return idOf((value as AnyRecord)._id);
  return String(value);
}

function sanitizeText(value: unknown, max = 4000) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/[^\S\r\n]+/g, " ")
    .trim()
    .slice(0, max);
}

function sanitizeContext(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[trimmed]";
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeContext(item, depth + 1));
  if (typeof value !== "object") return typeof value === "string" ? sanitizeText(value, 800) : value;
  const blocked = new Set(["password", "token", "secret", "apiKey", "publicId", "metadata", "idempotencyKey", "__v"]);
  return Object.fromEntries(
    Object.entries(value as AnyRecord)
      .filter(([key]) => !blocked.has(key) && !key.toLowerCase().includes("password") && !key.toLowerCase().includes("token"))
      .slice(0, 50)
      .map(([key, item]) => [key, sanitizeContext(item, depth + 1)])
  );
}

function assertRateLimit(userId: string) {
  const now = Date.now();
  const key = userId;
  const current = rateLimit.get(key);
  if (!current || current.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  if (current.count >= RATE_LIMIT_MAX) throw new AIPlatformError("تم تجاوز حد استخدام المساعد الذكي مؤقتا", 429);
  current.count += 1;
}

function providerConfig() {
  const provider = process.env.AI_PROVIDER?.trim() || "";
  const apiKey = process.env.AI_API_KEY?.trim() || "";
  const baseUrl = process.env.AI_API_BASE_URL?.trim() || "";
  const model = process.env.AI_MODEL?.trim() || "";
  if (!provider || !apiKey || !baseUrl || !model) {
    throw new AIPlatformError("مزود الذكاء الاصطناعي غير مهيأ. يرجى ضبط AI_PROVIDER و AI_API_KEY و AI_API_BASE_URL و AI_MODEL.", 503);
  }
  return { provider, apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model };
}

async function requireAIScope(scope: AIConversationScope) {
  const user = await getCurrentUser();
  if (!user) throw new AIPlatformError("غير مصرح", 401);
  const permissionByScope: Record<AIConversationScope, Permission> = {
    admin: "ai.admin",
    teacher: "ai.teacher",
    parent: "ai.parent",
    student: "ai.student",
  };
  if (!hasPermission(user.role, "ai.use") || !hasPermission(user.role, permissionByScope[scope])) {
    throw new AIPlatformError("ليست لديك صلاحية لاستخدام هذا المساعد", 403);
  }
  if (scope === "teacher" && user.role !== "teacher") throw new AIPlatformError("مساعد الأستاذ متاح للأساتذة فقط", 403);
  if (scope === "parent" && user.role !== "parent") throw new AIPlatformError("مساعد الولي متاح للأولياء فقط", 403);
  if (scope === "student" && user.role !== "student") throw new AIPlatformError("مساعد الطالب متاح للطلاب فقط", 403);
  if (scope === "admin" && !["admin", "deputy", "secretary"].includes(user.role)) throw new AIPlatformError("مساعد الإدارة متاح للطاقم فقط", 403);
  assertRateLimit(user._id);
  await connectDB();
  return user;
}

async function adminContext() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const [students, teachers, activeCourses, absentToday, unpaidCharges, paymentsToday, privateLessonsToday, kindergartenOverdue] = await Promise.all([
    User.countDocuments({ role: "student", deletedAt: null }),
    Teacher.countDocuments({ deletedAt: null }),
    Course.countDocuments({ deletedAt: null, isActive: true }),
    StudentAttendance.countDocuments({ status: "absent", date: { $gte: todayStart, $lt: todayEnd } }),
    StudentCharge.countDocuments({ balanceMinor: { $gt: 0 }, status: { $in: ["pending", "partially_paid", "overdue"] } }),
    StudentPayment.aggregate([{ $match: { paymentDate: { $gte: todayStart, $lt: todayEnd } } }, { $group: { _id: null, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } }]),
    PrivateLesson.countDocuments({ deletedAt: null, lessonDate: { $gte: todayStart, $lt: todayEnd } }),
    KindergartenRegistration.countDocuments({ deletedAt: null, totalOutstandingMinor: { $gt: 0 } }),
  ]);
  return {
    scope: "admin",
    summary: {
      students,
      teachers,
      activeCourses,
      absentToday,
      unpaidCharges,
      paymentsToday: minorToAmount((paymentsToday[0] as AnyRecord | undefined)?.total),
      paymentsTodayCount: (paymentsToday[0] as AnyRecord | undefined)?.count ?? 0,
      privateLessonsToday,
      kindergartenOverdue,
    },
  };
}

async function buildContext(scope: AIConversationScope) {
  if (scope === "admin") return adminContext();
  if (scope === "teacher") {
    const [dashboard, schedule, students, reports] = await Promise.all([
      getTeacherDashboardData(),
      getTeacherSchedule(),
      getTeacherStudents(new URLSearchParams()),
      getTeacherReports(new URLSearchParams()),
    ]);
    return { scope, dashboard, schedule, students, reports };
  }
  if (scope === "parent") {
    const [children, attendance, finance, communications, privateLessons, kindergarten, transportation] = await Promise.all([
      getParentChildren(),
      getParentAttendance(),
      getParentFinance(),
      getParentCommunications(),
      getParentPrivateLessons(),
      getParentKindergarten(),
      getParentTransportation(),
    ]);
    return { scope, children, attendance, finance, communications, privateLessons, kindergarten, transportation };
  }
  const [profile, schedule, courses, attendance, grades, privateLessons, finance] = await Promise.all([
    getStudentProfile(),
    getStudentSchedule(),
    getStudentCourses(),
    getStudentAttendance(),
    getStudentGrades(),
    getStudentPrivateLessons(),
    getStudentFinance(),
  ]);
  return { scope, profile, schedule, courses, attendance, grades, privateLessons, finance };
}

function systemPrompt(scope: AIConversationScope) {
  const base = "أنت مساعد ذكي لمنصة أكاديمية هيثم التعليمية. أجب بالعربية الفصحى المبسطة، واحترم RTL. لا تطلب أو تعرض أسرارا أو كلمات مرور أو مفاتيح API. لا تعدل أي بيانات. إذا احتجت إجراء تغييرا، اقترح خطوات مراجعة بشرية فقط.";
  const scopes: Record<AIConversationScope, string> = {
    admin: "نطاقك إداري: استخدم فقط ملخصات وبيانات مصرح بها للطاقم. لا تكشف أسرار النظام أو بيانات حساسة غير لازمة.",
    teacher: "نطاقك أستاذ: استخدم فقط بيانات الأستاذ الحالي وطلابه وحصصه وتقاريره المصرح بها. لا تذكر طلابا غير مسندين.",
    parent: "نطاقك ولي أمر: استخدم فقط بيانات الأبناء المرتبطين بهذا الحساب. لا تكشف بيانات عائلات أخرى.",
    student: "نطاقك طالب: ساعد تعليميا وتنظيميا باستخدام بيانات الطالب الحالي فقط. لا تكشف إجابات امتحانات حية أو تعدل سجلات.",
  };
  return `${base}\n${scopes[scope]}`;
}

async function callProvider(input: { scope: AIConversationScope; message: string; context: unknown; history: { role: string; content: string }[] }) {
  const config = providerConfig();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt(input.scope) },
        { role: "system", content: `السياق المصرح والمختصر:\n${JSON.stringify(sanitizeContext(input.context)).slice(0, 12000)}` },
        ...input.history.slice(-8),
        { role: "user", content: input.message },
      ],
      temperature: 0.2,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AIPlatformError(`فشل مزود الذكاء الاصطناعي: ${sanitizeText((payload as AnyRecord).error ? JSON.stringify((payload as AnyRecord).error) : response.statusText, 500)}`, 502);
  }
  const choices = Array.isArray((payload as AnyRecord).choices) ? ((payload as AnyRecord).choices as AnyRecord[]) : [];
  const content = ((choices[0]?.message as AnyRecord | undefined)?.content ?? choices[0]?.text ?? "").toString().trim();
  if (!content) throw new AIPlatformError("لم يرجع مزود الذكاء الاصطناعي إجابة صالحة", 502);
  return { content: sanitizeText(content, 8000), provider: config.provider, model: config.model };
}

async function upsertConversation(params: {
  userId: string;
  userRole: string;
  scope: AIConversationScope;
  conversationId?: string;
  message: string;
  answer?: string;
  error?: string;
  provider?: string;
  model?: string;
}) {
  const conversation =
    params.conversationId && Types.ObjectId.isValid(params.conversationId)
      ? await AIConversation.findOne({ _id: params.conversationId, userId: params.userId, scope: params.scope })
      : null;
  const target =
    conversation ??
    new AIConversation({
      userId: params.userId,
      userRole: params.userRole,
      scope: params.scope,
      title: sanitizeText(params.message, 80) || "محادثة ذكاء اصطناعي",
      messages: [],
    });
  target.messages.push({ role: "user", content: params.message, createdAt: new Date(), metadata: {} });
  if (params.answer) target.messages.push({ role: "assistant", content: params.answer, createdAt: new Date(), metadata: { provider: params.provider, model: params.model } });
  if (params.error) target.lastError = params.error;
  if (params.provider) target.provider = params.provider;
  if (params.model) target.modelName = params.model;
  await target.save();
  return target;
}

export async function listAIConversations(scope: AIConversationScope) {
  const user = await requireAIScope(scope);
  const conversations = await AIConversation.find({ userId: user._id, scope, status: "active" }).sort({ updatedAt: -1 }).limit(50).lean<AnyRecord[]>();
  return {
    conversations: conversations.map((row) => ({
      id: idOf(row._id),
      title: row.title ?? "",
      scope: row.scope,
      updatedAt: row.updatedAt,
      messageCount: Array.isArray(row.messages) ? row.messages.length : 0,
      lastError: row.lastError ?? "",
    })),
  };
}

export async function sendAIMessage(body: AnyRecord) {
  const scope = ["admin", "teacher", "parent", "student"].includes(String(body.scope)) ? (String(body.scope) as AIConversationScope) : "student";
  const user = await requireAIScope(scope);
  const message = sanitizeText(body.message, 2000);
  if (message.length < 2) throw new AIPlatformError("اكتب سؤالا واضحا للمساعد الذكي", 400);
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined;
  const existing =
    conversationId && Types.ObjectId.isValid(conversationId)
      ? await AIConversation.findOne({ _id: conversationId, userId: user._id, scope }).lean<AnyRecord>()
      : null;
  const history = Array.isArray(existing?.messages)
    ? (existing.messages as AnyRecord[]).map((item) => ({ role: String(item.role), content: sanitizeText(item.content, 2000) })).filter((item) => ["user", "assistant"].includes(item.role))
    : [];

  const context = await buildContext(scope);
  try {
    const answer = await callProvider({ scope, message, context, history });
    const conversation = await upsertConversation({ userId: user._id, userRole: user.role, scope, conversationId, message, answer: answer.content, provider: answer.provider, model: answer.model });
    await recordAudit({ userId: user._id, action: "ai.message", recordType: "ai_conversation", recordId: conversation._id.toString(), metadata: { scope, provider: answer.provider, contextKeys: Object.keys(context as AnyRecord) } });
    return { conversationId: conversation._id.toString(), answer: answer.content, provider: answer.provider, model: answer.model };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "فشل طلب الذكاء الاصطناعي";
    const conversation = await upsertConversation({ userId: user._id, userRole: user.role, scope, conversationId, message, error: messageText });
    await recordAudit({ userId: user._id, action: "ai.message_failed", recordType: "ai_conversation", recordId: conversation._id.toString(), metadata: { scope, error: messageText } });
    throw error;
  }
}

function dayRange(kind: "today" | "tomorrow" | "week") {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (kind === "tomorrow") start.setDate(start.getDate() + 1);
  const end = new Date(start);
  if (kind === "week") end.setDate(end.getDate() + 7);
  else end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function runNaturalDataQuery(body: AnyRecord) {
  const user = await requireAIScope("admin");
  if (!hasPermission(user.role, "ai.data_query")) throw new AIPlatformError("ليست لديك صلاحية الاستعلام الذكي عن البيانات", 403);
  const q = sanitizeText(body.query, 500).toLowerCase();
  await connectDB();
  let result: unknown;
  let intent = "unknown";
  const today = dayRange(q.includes("tomorrow") || q.includes("غدا") ? "tomorrow" : q.includes("week") || q.includes("أسبوع") ? "week" : "today");
  if ((q.includes("absent") || q.includes("غياب") || q.includes("غائب")) && (q.includes("today") || q.includes("اليوم"))) {
    intent = "absent_students";
    result = await StudentAttendance.find({ status: "absent", date: { $gte: today.start, $lt: today.end } }).populate("studentId", "name academicLevel className guardianName").sort({ date: -1 }).limit(100).lean();
  } else if (q.includes("unpaid") || q.includes("غير مدفوع") || q.includes("متأخر") || q.includes("ديون")) {
    intent = "unpaid_students";
    result = await StudentCharge.find({ balanceMinor: { $gt: 0 }, status: { $in: ["pending", "partially_paid", "overdue"] } }).populate("studentId", "name academicLevel className").sort({ balanceMinor: -1 }).limit(100).lean();
  } else if (q.includes("payment") || q.includes("payments") || q.includes("مدفوعات") || q.includes("دفعات")) {
    intent = "payments_period";
    result = await StudentPayment.find({ paymentDate: { $gte: today.start, $lt: today.end } }).populate("studentId", "name").sort({ paymentDate: -1 }).limit(100).lean();
  } else if (q.includes("private lesson") || q.includes("حصص خاصة") || q.includes("حصة خاصة")) {
    intent = "private_lessons_period";
    result = await PrivateLesson.find({ deletedAt: null, lessonDate: { $gte: today.start, $lt: today.end } }).populate("teacherId", "name subject").sort({ startAt: 1 }).limit(100).lean();
  } else if (q.includes("kindergarten") || q.includes("روضة")) {
    intent = "kindergarten_overdue";
    result = await KindergartenRegistration.find({ deletedAt: null, totalOutstandingMinor: { $gt: 0 } }).sort({ totalOutstandingMinor: -1 }).limit(100).lean();
  } else if (q.includes("attendance below") || q.includes("حضور أقل")) {
    intent = "attendance_below_threshold";
    result = await StudentAttendance.aggregate([
      { $group: { _id: "$studentId", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } } } },
      { $addFields: { percentage: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 0] } } },
      { $match: { percentage: { $lt: 80 } } },
      { $sort: { percentage: 1 } },
      { $limit: 100 },
    ]);
  } else if (q.includes("course") || q.includes("دورة")) {
    intent = "course_enrollments";
    result = await Enrollment.find({ status: { $in: ["approved", "accepted", "pending"] } }).populate("student", "name academicLevel className").populate("course", "title level").sort({ createdAt: -1 }).limit(100).lean();
  } else {
    throw new AIPlatformError("لم يتم التعرف على نوع الاستعلام. جرّب: الغياب اليوم، الدفعات هذا الأسبوع، الطلاب غير المدفوعين، الحصص الخاصة غدا.", 400);
  }
  await recordAudit({ userId: user._id, action: "ai.data_query", recordType: "ai_query", metadata: { intent, query: q } });
  return { intent, query: body.query, rows: sanitizeContext(result) };
}

export function aiProviderStatus() {
  return {
    providerConfigured: Boolean(process.env.AI_PROVIDER && process.env.AI_API_KEY && process.env.AI_API_BASE_URL && process.env.AI_MODEL),
    provider: process.env.AI_PROVIDER ? sanitizeText(process.env.AI_PROVIDER, 80) : "",
    modelConfigured: Boolean(process.env.AI_MODEL),
    baseUrlConfigured: Boolean(process.env.AI_API_BASE_URL),
  };
}
