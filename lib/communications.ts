import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Enrollment from "@/models/Enrollment";
import KindergartenRegistration from "@/models/Kindergarten";
import TransportSubscription from "@/models/TransportSubscription";
import { Guardian, StudentCommunication } from "@/models/StudentRecords";
import {
  Communication,
  CommunicationDelivery,
  CommunicationPreference,
  CommunicationProviderSetting,
  CommunicationTemplate,
  type CommunicationChannel,
  type CommunicationStatus,
  type ICommunication,
} from "@/models/Communication";

type AnyRecord = Record<string, unknown>;
type LeanRecord = AnyRecord & { _id?: { toString(): string } | string; createdAt?: Date; updatedAt?: Date };
type TemplateRecord = {
  _id: { toString(): string };
  version: number;
  subject?: string;
  content: string;
  arabicContent?: string;
};

const CHANNELS: CommunicationChannel[] = ["in_app", "email", "sms", "whatsapp", "administrative_notice", "phone_call", "guardian_meeting"];
const STATUSES: CommunicationStatus[] = ["draft", "scheduled", "queued", "processing", "sent", "partially_sent", "delivered", "failed", "cancelled", "expired"];
const TEMPLATE_VARIABLES = new Set([
  "student_name",
  "guardian_name",
  "teacher_name",
  "academy_name",
  "course_name",
  "class_name",
  "group_name",
  "payment_amount",
  "remaining_balance",
  "payment_due_date",
  "receipt_number",
  "invoice_number",
  "lesson_date",
  "lesson_time",
  "attendance_status",
  "transportation_route",
  "academic_season",
  "academy_phone",
  "academy_address",
]);

interface Recipient {
  recipientType: "student" | "guardian" | "teacher" | "employee" | "user" | "custom";
  recipientId?: string;
  recipientName: string;
  destination?: string;
  userId?: string;
  studentId?: string;
  variables: Record<string, string>;
}

export function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function normalizePhone(value: unknown) {
  const raw = String(value ?? "").replace(/[^\d+]/g, "");
  if (!raw) return "";
  const normalized = raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
  return normalized.replace(/^\+2130/, "+213").replace(/^0(?=\d{9}$)/, "+213");
}

export function maskDestination(value: unknown) {
  const destination = String(value ?? "");
  if (!destination) return "";
  if (destination.includes("@")) {
    const [name, domain] = destination.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return destination.length > 5 ? `${destination.slice(0, 4)}***${destination.slice(-2)}` : "***";
}

export function sanitizeContent(value: unknown) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .trim();
}

function stringId(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toString" in value) return String(value);
  return "";
}

function objectId(value: unknown) {
  const id = stringId(value);
  return mongoose.Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : undefined;
}

function dateFilter(searchParams: URLSearchParams) {
  const filter: Record<string, Date> = {};
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(`${to}T23:59:59.999Z`);
  return Object.keys(filter).length ? filter : undefined;
}

function destinationFor(channel: CommunicationChannel, recipient: Recipient) {
  if (["in_app", "administrative_notice", "phone_call", "guardian_meeting"].includes(channel)) return recipient.destination || recipient.userId || recipient.recipientId || "";
  if (channel === "email") return normalizeEmail(recipient.destination);
  return normalizePhone(recipient.destination);
}

function providerEnv(channel: CommunicationChannel) {
  if (channel === "email") return { provider: process.env.EMAIL_PROVIDER || "", sender: process.env.EMAIL_FROM || "", configured: Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_FROM) };
  if (channel === "sms") return { provider: process.env.SMS_PROVIDER || "", sender: process.env.SMS_SENDER || "", configured: Boolean(process.env.SMS_PROVIDER && process.env.SMS_SENDER) };
  if (channel === "whatsapp") return { provider: process.env.WHATSAPP_PROVIDER || "", sender: process.env.WHATSAPP_SENDER || "", configured: Boolean(process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_SENDER) };
  return { provider: "internal", sender: "Haytham Academy", configured: true };
}

export async function providerStatuses() {
  await connectDB();
  const configured = (["email", "sms", "whatsapp"] as const).map((providerType) => {
    const channel = providerType as CommunicationChannel;
    const env = providerEnv(channel);
    return CommunicationProviderSetting.findOneAndUpdate(
      { providerType },
      {
        providerType,
        providerName: env.provider || "not_configured",
        enabled: env.configured,
        senderIdentity: env.sender || "",
        connectionStatus: env.configured ? "configured" : "missing_config",
        lastFailure: env.configured ? "" : "Provider environment variables are missing.",
        safeSummary: { providerConfigured: Boolean(env.provider), senderConfigured: Boolean(env.sender) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  });
  return (await Promise.all(configured)).map((item) => formatProvider(item as unknown as LeanRecord));
}

function formatProvider(item: LeanRecord) {
  return {
    _id: stringId(item._id),
    providerType: item.providerType,
    providerName: item.providerName,
    enabled: Boolean(item.enabled),
    senderIdentity: item.senderIdentity || "",
    connectionStatus: item.connectionStatus || "unknown",
    lastSuccessfulCheck: item.lastSuccessfulCheck || "",
    lastFailure: item.lastFailure || "",
    safeSummary: item.safeSummary || {},
    updatedAt: item.updatedAt || "",
  };
}

async function preferenceAllows(recipient: Recipient, channel: CommunicationChannel, override: boolean) {
  if (override || ["administrative_notice", "phone_call", "guardian_meeting"].includes(channel)) return true;
  const ownerId = objectId(recipient.recipientId);
  const preference = await CommunicationPreference.findOne({
    ownerType: recipient.recipientType,
    ...(ownerId ? { ownerId } : {}),
  }).lean();
  if (!preference) return true;
  if (preference.optedOut) return false;
  if (channel === "in_app") return preference.allowInApp !== false;
  if (channel === "email") return preference.allowEmail !== false;
  if (channel === "sms") return preference.allowSms !== false;
  if (channel === "whatsapp") return preference.allowWhatsapp !== false;
  return true;
}

function variablesFor(row: AnyRecord, extra: Record<string, string> = {}) {
  return {
    student_name: String(row.name || row.studentName || ""),
    guardian_name: String(row.guardianName || ""),
    teacher_name: String(row.teacherName || row.name || ""),
    class_name: String(row.className || ""),
    group_name: String(row.groupName || ""),
    academic_season: String(row.academicSeason || ""),
    academy_name: "Haytham Educational Academy",
    academy_phone: process.env.ACADEMY_PHONE || "",
    academy_address: process.env.ACADEMY_ADDRESS || "",
    ...extra,
  };
}

async function recipientsFromUsers(filter: AnyRecord, recipientType: Recipient["recipientType"], channel: CommunicationChannel) {
  const users = await User.find(filter).select("name email phone guardianName guardianPhone academicSeason academicLevel className groupName role").limit(5000).lean() as unknown as AnyRecord[];
  return users.map((user: AnyRecord) => ({
    recipientType,
    recipientId: stringId(user._id),
    userId: recipientType === "student" || recipientType === "user" || recipientType === "employee" ? stringId(user._id) : undefined,
    studentId: recipientType === "guardian" ? stringId(user._id) : undefined,
    recipientName: recipientType === "guardian" ? String(user.guardianName || user.name) : String(user.name || ""),
    destination: recipientType === "guardian" ? String(user.guardianPhone || "") : channel === "email" ? String(user.email || "") : String(user.phone || ""),
    variables: variablesFor(user),
  }));
}

export async function resolveRecipients(input: AnyRecord, channel: CommunicationChannel, canUseCustom = false) {
  await connectDB();
  const scope = String(input.type || input.recipientType || "selected");
  const ids = Array.isArray(input.ids) ? input.ids.map(String).filter(Boolean) : [];
  const filters = (input.filters && typeof input.filters === "object" ? input.filters : {}) as AnyRecord;
  let recipients: Recipient[] = [];

  if (scope === "all_active_students") {
    recipients = await recipientsFromUsers({ role: "student", isActive: true, deletedAt: null }, "student", channel);
  } else if (scope === "all_active_teachers") {
    const teachers = await Teacher.find({ deletedAt: null, status: "active" }).select("name email phone subject assignedClasses").limit(5000).lean() as unknown as AnyRecord[];
    recipients = teachers.map((teacher: AnyRecord) => ({ recipientType: "teacher", recipientId: stringId(teacher._id), recipientName: String(teacher.name || ""), destination: channel === "email" ? String(teacher.email || "") : String(teacher.phone || ""), variables: variablesFor({ teacherName: teacher.name }) }));
  } else if (scope === "student" || scope === "selected_students") {
    recipients = await recipientsFromUsers({ role: "student", _id: { $in: ids.filter(mongoose.Types.ObjectId.isValid) }, deletedAt: null }, "student", channel);
  } else if (scope === "guardian" || scope === "selected_guardians") {
    if (ids.length) {
      const guardians = await Guardian.find({ _id: { $in: ids.filter(mongoose.Types.ObjectId.isValid) } }).limit(5000).lean() as unknown as AnyRecord[];
      recipients = guardians.map((g: AnyRecord) => ({ recipientType: "guardian", recipientId: stringId(g._id), recipientName: String(g.fullName || ""), destination: channel === "email" ? String(g.email || "") : String(g.primaryPhone || ""), variables: variablesFor({ guardianName: g.fullName }) }));
    } else {
      recipients = await recipientsFromUsers({ role: "student", deletedAt: null }, "guardian", channel);
    }
  } else if (scope === "teacher" || scope === "selected_teachers") {
    const teachers = await Teacher.find({ _id: { $in: ids.filter(mongoose.Types.ObjectId.isValid) }, deletedAt: null }).limit(5000).lean() as unknown as AnyRecord[];
    recipients = teachers.map((teacher: AnyRecord) => ({ recipientType: "teacher", recipientId: stringId(teacher._id), recipientName: String(teacher.name || ""), destination: channel === "email" ? String(teacher.email || "") : String(teacher.phone || ""), variables: variablesFor({ teacherName: teacher.name }) }));
  } else if (scope === "class") {
    recipients = await recipientsFromUsers({ role: "student", className: String(filters.className || input.className || ""), deletedAt: null }, "student", channel);
  } else if (scope === "group") {
    recipients = await recipientsFromUsers({ role: "student", groupName: String(filters.groupName || input.groupName || ""), deletedAt: null }, "student", channel);
  } else if (scope === "academic_level") {
    recipients = await recipientsFromUsers({ role: "student", academicLevel: String(filters.academicLevel || input.academicLevel || ""), deletedAt: null }, "student", channel);
  } else if (scope === "course") {
    const courseId = ids[0] || stringId(filters.courseId);
    const enrollments = await Enrollment.find({ course: courseId, status: { $in: ["pending", "approved", "accepted"] } }).select("student").lean() as unknown as AnyRecord[];
    recipients = await recipientsFromUsers({ role: "student", _id: { $in: enrollments.map((e: AnyRecord) => e.student) }, deletedAt: null }, "student", channel);
  } else if (scope === "enrollment_type") {
    recipients = await recipientsFromUsers({ role: "student", enrollmentType: String(filters.enrollmentType || ""), deletedAt: null }, "student", channel);
  } else if (scope === "kindergarten_group") {
    const rows = await KindergartenRegistration.find({ groupName: String(filters.groupName || ""), status: "active" }).limit(5000).lean() as unknown as AnyRecord[];
    recipients = rows.map((row: AnyRecord) => ({ recipientType: "guardian", recipientId: stringId(row._id), recipientName: String(row.guardianName || row.childName || ""), destination: String(row.guardianPhone || ""), variables: variablesFor({ studentName: row.childName, guardianName: row.guardianName, groupName: row.groupName }) }));
  } else if (scope === "transportation_route") {
    const rows = await TransportSubscription.find({ routeId: ids[0], status: "active" }).populate("studentId", "name phone guardianName guardianPhone").limit(5000).lean() as unknown as AnyRecord[];
    recipients = rows.map((row: AnyRecord) => {
      const student = row.studentId as AnyRecord;
      return { recipientType: "guardian", recipientId: stringId(row._id), recipientName: String(student?.guardianName || student?.name || ""), destination: String(student?.guardianPhone || student?.phone || ""), variables: variablesFor(student || {}) };
    });
  } else if (scope === "custom" && canUseCustom) {
    const custom = Array.isArray(input.customRecipients) ? input.customRecipients : [];
    recipients = custom.map((item: AnyRecord, index: number) => ({ recipientType: "custom", recipientId: `custom-${index}`, recipientName: String(item.name || item.destination || "مستلم"), destination: String(item.destination || item.phone || item.email || ""), variables: variablesFor(item) }));
  }

  const seen = new Set<string>();
  let duplicateCount = 0;
  let invalidCount = 0;
  let missingContactCount = 0;
  const valid: Recipient[] = [];
  for (const recipient of recipients) {
    const destination = destinationFor(channel, recipient);
    if (!destination) {
      missingContactCount += 1;
      continue;
    }
    const invalid = channel === "email" ? !normalizeEmail(destination) : ["sms", "whatsapp"].includes(channel) ? !normalizePhone(destination) : false;
    if (invalid) {
      invalidCount += 1;
      continue;
    }
    const key = `${channel}:${destination}:${recipient.recipientType}`;
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    valid.push({ ...recipient, destination });
  }

  return { recipients: valid, duplicateCount, invalidCount, missingContactCount, totalCandidates: recipients.length };
}

export function renderTemplate(content: string, variables: Record<string, string>) {
  return sanitizeContent(content).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name: string) => {
    if (!TEMPLATE_VARIABLES.has(name)) throw new Error(`متغير غير مسموح في القالب: ${name}`);
    return variables[name] ?? "";
  });
}

export function estimateSmsSegments(content: string) {
  const length = content.length;
  return Math.max(1, Math.ceil(length / 70));
}

function formatCommunication(item: LeanRecord) {
  return {
    _id: stringId(item._id),
    channel: item.channel,
    category: item.category,
    subject: item.subject || "",
    content: item.content || "",
    recipientScope: item.recipientScope || {},
    recipientCount: item.recipientCount || 0,
    duplicateCount: item.duplicateCount || 0,
    invalidCount: item.invalidCount || 0,
    optedOutCount: item.optedOutCount || 0,
    missingContactCount: item.missingContactCount || 0,
    status: item.status,
    priority: item.priority,
    scheduledAt: item.scheduledAt || "",
    sentAt: item.sentAt || "",
    failedAt: item.failedAt || "",
    cancelledAt: item.cancelledAt || "",
    errorSummary: item.errorSummary || "",
    provider: item.provider || "",
    related: item.related || {},
    internalNotes: item.internalNotes || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function formatDelivery(item: LeanRecord, sensitive = false) {
  return {
    _id: stringId(item._id),
    communicationId: stringId(item.communicationId),
    recipientType: item.recipientType,
    recipientId: stringId(item.recipientId),
    recipientName: item.recipientName || "",
    destination: sensitive ? item.destination || "" : item.destinationMasked || maskDestination(item.destination),
    channel: item.channel,
    provider: item.provider || "",
    providerMessageId: item.providerMessageId || "",
    status: item.status,
    queuedAt: item.queuedAt || "",
    sentAt: item.sentAt || "",
    deliveredAt: item.deliveredAt || "",
    failedAt: item.failedAt || "",
    failureCode: item.failureCode || "",
    failureMessage: item.failureMessage || "",
    retryCount: item.retryCount || 0,
    createdAt: item.createdAt || "",
  };
}

export async function listCommunications(searchParams: URLSearchParams) {
  await connectDB();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
  const filter: AnyRecord = {};
  const search = searchParams.get("search")?.trim();
  const status = searchParams.get("status");
  const channel = searchParams.get("channel") as CommunicationChannel | null;
  const category = searchParams.get("category");
  const createdAt = dateFilter(searchParams);
  if (search) filter.$text = { $search: search };
  if (status && STATUSES.includes(status as CommunicationStatus)) filter.status = status;
  if (channel && CHANNELS.includes(channel)) filter.channel = channel;
  if (category) filter.category = category;
  if (createdAt) filter.createdAt = createdAt;
  if (searchParams.get("academicSeason")) filter["related.academicSeason"] = searchParams.get("academicSeason");

  const [items, total] = await Promise.all([
    Communication.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Communication.countDocuments(filter),
  ]);
  return { communications: items.map((item) => formatCommunication(item as unknown as LeanRecord)), pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), hasPrev: page > 1, hasNext: page * limit < total } };
}

export async function getCommunication(id: string, sensitive = false) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("معرف غير صالح");
  const [communication, deliveries] = await Promise.all([
    Communication.findById(id).lean(),
    CommunicationDelivery.find({ communicationId: id }).sort({ createdAt: -1 }).limit(500).lean(),
  ]);
  if (!communication) throw new Error("التواصل غير موجود");
  return { communication: formatCommunication(communication as unknown as LeanRecord), deliveries: deliveries.map((item) => formatDelivery(item as unknown as LeanRecord, sensitive)) };
}

export async function previewRecipients(body: AnyRecord, canUseCustom = false) {
  const channel = CHANNELS.includes(body.channel as CommunicationChannel) ? (body.channel as CommunicationChannel) : "in_app";
  const resolved = await resolveRecipients((body.recipientScope || body) as AnyRecord, channel, canUseCustom);
  return {
    channel,
    count: resolved.recipients.length,
    duplicateCount: resolved.duplicateCount,
    invalidCount: resolved.invalidCount,
    missingContactCount: resolved.missingContactCount,
    smsSegments: channel === "sms" ? estimateSmsSegments(String(body.content || "")) : 0,
    recipients: resolved.recipients.slice(0, 100).map((recipient) => ({
      recipientType: recipient.recipientType,
      recipientId: recipient.recipientId,
      recipientName: recipient.recipientName,
      destination: maskDestination(destinationFor(channel, recipient)),
    })),
    provider: providerEnv(channel),
  };
}

export async function createCommunicationRecord(body: AnyRecord, userId: string, options: { mode: "draft" | "send" | "schedule"; canUseCustom?: boolean; overridePreferences?: boolean; overrideReason?: string }) {
  await connectDB();
  const channel = CHANNELS.includes(body.channel as CommunicationChannel) ? (body.channel as CommunicationChannel) : "in_app";
  const content = sanitizeContent(body.content);
  if (!content) throw new Error("محتوى الرسالة مطلوب");
  if (channel === "email" && !String(body.subject || "").trim()) throw new Error("عنوان البريد مطلوب");
  const scheduledAt = body.scheduledAt ? new Date(String(body.scheduledAt)) : undefined;
  if (options.mode === "schedule" && (!scheduledAt || scheduledAt <= new Date())) throw new Error("تاريخ الجدولة غير صالح");
  const idempotencyKey = String(body.idempotencyKey || crypto.createHash("sha256").update(`${userId}:${channel}:${content}:${Date.now()}`).digest("hex"));
  const scope = (body.recipientScope && typeof body.recipientScope === "object" ? body.recipientScope : { type: "selected", ids: [] }) as AnyRecord;
  const resolved = await resolveRecipients(scope, channel, options.canUseCustom);
  let optedOutCount = 0;
  const allowed: Recipient[] = [];
  for (const recipient of resolved.recipients) {
    if (await preferenceAllows(recipient, channel, Boolean(options.overridePreferences))) allowed.push(recipient);
    else optedOutCount += 1;
  }
  if (options.mode !== "draft" && allowed.length === 0) throw new Error("لا يوجد مستلمون صالحون بعد تطبيق التفضيلات ومعلومات الاتصال");
  const env = providerEnv(channel);
  const initialStatus: CommunicationStatus = options.mode === "draft" ? "draft" : options.mode === "schedule" ? "scheduled" : "queued";
  const communication = await Communication.create({
    channel,
    category: String(body.category || "general"),
    subject: sanitizeContent(body.subject),
    content,
    arabicContent: sanitizeContent(body.arabicContent || content),
    templateId: objectId(body.templateId),
    recipientScope: { type: String(scope.type || "selected"), ids: Array.isArray(scope.ids) ? scope.ids.map(String) : [], filters: (scope.filters || {}) as AnyRecord },
    recipientCount: allowed.length,
    duplicateCount: resolved.duplicateCount,
    invalidCount: resolved.invalidCount,
    missingContactCount: resolved.missingContactCount,
    optedOutCount,
    status: initialStatus,
    priority: (["low", "normal", "high", "urgent"].includes(String(body.priority)) ? String(body.priority) : "normal") as "low" | "normal" | "high" | "urgent",
    scheduledAt,
    idempotencyKey,
    related: body.related || {},
    attachments: Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [],
    internalNotes: sanitizeContent(body.internalNotes),
    provider: env.provider || undefined,
    providerSummary: { configured: env.configured, senderConfigured: Boolean(env.sender) },
    createdBy: objectId(userId),
  } as unknown as Partial<ICommunication>) as ICommunication;

  if (allowed.length) {
    await CommunicationDelivery.insertMany(
      allowed.map((recipient) => {
        const destination = destinationFor(channel, recipient);
        return {
          communicationId: communication._id,
          recipientType: recipient.recipientType,
          recipientId: objectId(recipient.recipientId),
          recipientName: recipient.recipientName,
          destination,
          destinationMasked: maskDestination(destination),
          channel,
          provider: env.provider || "internal",
          status: initialStatus === "draft" ? "draft" : "queued",
          queuedAt: initialStatus === "queued" ? new Date() : undefined,
          metadata: { variables: recipient.variables, userId: recipient.userId, studentId: recipient.studentId },
        };
      }),
      { ordered: false }
    ).catch(() => undefined);
  }

  await recordAudit({ userId, action: options.mode === "send" ? "communication.send.requested" : options.mode === "schedule" ? "communication.scheduled" : "communication.created", recordType: "communication", recordId: communication._id.toString(), metadata: { channel, recipientScope: scope.type, recipientCount: allowed.length, overrideReason: options.overrideReason || "" } });
  if (options.mode === "send") await processCommunication(communication._id.toString(), userId);
  return getCommunication(communication._id.toString(), true);
}

export async function processCommunication(id: string, userId: string) {
  await connectDB();
  const communication = await Communication.findById(id);
  if (!communication) throw new Error("التواصل غير موجود");
  if (["sent", "delivered", "cancelled"].includes(communication.status)) return getCommunication(id, true);
  const env = providerEnv(communication.channel);
  const deliveries = await CommunicationDelivery.find({ communicationId: communication._id, status: { $in: ["queued", "scheduled", "draft", "failed"] } }).lean() as unknown as AnyRecord[];
  await Communication.updateOne({ _id: communication._id }, { status: "processing", processingStartedAt: new Date(), lockToken: crypto.randomUUID(), lockExpiresAt: new Date(Date.now() + 5 * 60_000) });
  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries) {
    const deliveryId = objectId(delivery._id);
    if (!env.configured) {
      failed += 1;
      await CommunicationDelivery.updateOne({ _id: deliveryId }, { status: "failed", failedAt: new Date(), failureCode: "provider_missing_config", failureMessage: "Provider is not configured. No credentials were logged or exposed." });
      continue;
    }
    if (communication.channel === "in_app") {
      const metadata = (delivery.metadata || {}) as AnyRecord;
      const targetUserId = stringId(metadata.userId) || stringId(delivery.recipientId);
      if (mongoose.Types.ObjectId.isValid(targetUserId)) {
        await createNotification({ title: communication.subject || "إشعار", message: communication.content, type: communication.priority === "urgent" ? "warning" : "info", domain: "system", userId: targetUserId, data: { communicationId: communication._id.toString() }, createdBy: userId });
      }
    }
    sent += 1;
    await CommunicationDelivery.updateOne({ _id: deliveryId }, { status: communication.channel === "in_app" ? "delivered" : "sent", sentAt: new Date(), deliveredAt: communication.channel === "in_app" ? new Date() : undefined, providerMessageId: `${env.provider || "internal"}-${stringId(delivery._id)}` });
    const metadata = (delivery.metadata || {}) as AnyRecord;
    if (metadata.studentId && mongoose.Types.ObjectId.isValid(String(metadata.studentId))) {
      const historyPayload: Record<string, unknown> = { studentId: objectId(metadata.studentId), type: communication.channel === "in_app" ? "internal_notification" : communication.channel, subject: String(communication.subject || "تواصل"), content: String(communication.content), recipient: String(delivery.recipientName || delivery.destinationMasked || ""), deliveryStatus: "sent", recordedBy: objectId(userId) };
      await StudentCommunication.create(historyPayload).catch(() => undefined);
    }
  }
  const status: CommunicationStatus = failed && sent ? "partially_sent" : failed ? "failed" : communication.channel === "in_app" ? "delivered" : "sent";
  await Communication.updateOne({ _id: communication._id }, { status, sentAt: sent ? new Date() : undefined, failedAt: failed ? new Date() : undefined, errorSummary: failed ? "بعض/كل الرسائل فشلت بسبب إعدادات المزود أو التسليم." : "", lockToken: "", lockExpiresAt: null });
  await recordAudit({ userId, action: "communication.processed", recordType: "communication", recordId: communication._id.toString(), metadata: { sent, failed, channel: communication.channel } });
  return getCommunication(id, true);
}

export async function cancelCommunication(id: string, userId: string) {
  await connectDB();
  const communication = await Communication.findById(id);
  if (!communication) throw new Error("التواصل غير موجود");
  if (!["draft", "scheduled", "queued", "failed"].includes(communication.status)) throw new Error("لا يمكن إلغاء هذا التواصل في حالته الحالية");
  await Communication.updateOne({ _id: id }, { status: "cancelled", cancelledAt: new Date(), cancelledBy: userId });
  await CommunicationDelivery.updateMany({ communicationId: objectId(id), status: { $in: ["draft", "scheduled", "queued", "failed"] } }, { status: "cancelled" });
  await recordAudit({ userId, action: "communication.cancelled", recordType: "communication", recordId: id, metadata: { previousStatus: communication.status } });
  return getCommunication(id, true);
}

export async function retryCommunication(id: string, userId: string) {
  await connectDB();
  await CommunicationDelivery.updateMany({ communicationId: objectId(id), status: "failed", retryCount: { $lt: 3 } }, { status: "queued", queuedAt: new Date(), $inc: { retryCount: 1 }, lastRetryAt: new Date() });
  await Communication.updateOne({ _id: id }, { status: "queued", $inc: { retryCount: 1 } });
  await recordAudit({ userId, action: "communication.retry", recordType: "communication", recordId: id });
  return processCommunication(id, userId);
}

export async function listTemplates(searchParams: URLSearchParams) {
  await connectDB();
  const filter: AnyRecord = {};
  const search = searchParams.get("search")?.trim();
  if (search) filter.$text = { $search: search };
  if (searchParams.get("category")) filter.category = searchParams.get("category");
  if (searchParams.get("channel")) filter.channel = searchParams.get("channel");
  const templates = await CommunicationTemplate.find(filter).sort({ updatedAt: -1 }).limit(500).lean() as unknown as AnyRecord[];
  return { templates: templates.map((item: AnyRecord) => ({ _id: stringId(item._id), name: item.name, code: item.code, category: item.category, channel: item.channel, subject: item.subject || "", content: item.content, arabicContent: item.arabicContent || "", variables: item.variables || [], isActive: item.isActive, version: item.version, updatedAt: item.updatedAt })) };
}

export async function upsertTemplate(body: AnyRecord, userId: string, id?: string) {
  await connectDB();
  const content = sanitizeContent(body.content);
  if (!content) throw new Error("محتوى القالب مطلوب");
  const variables = Array.from(new Set(Array.from(content.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1])));
  const invalid = variables.filter((name) => !TEMPLATE_VARIABLES.has(name));
  if (invalid.length) throw new Error(`متغيرات غير مسموحة: ${invalid.join(", ")}`);
  const payload = {
    name: sanitizeContent(body.name),
    code: String(body.code || body.name || "").trim().toLowerCase().replace(/\s+/g, "_"),
    category: String(body.category || "general"),
    channel: (CHANNELS.includes(body.channel as CommunicationChannel) ? body.channel : "in_app") as CommunicationChannel,
    subject: sanitizeContent(body.subject),
    content,
    arabicContent: sanitizeContent(body.arabicContent || content),
    secondaryContent: sanitizeContent(body.secondaryContent),
    variables,
    isActive: body.isActive !== false,
    updatedBy: userId,
  };
  if (!payload.name || !payload.code) throw new Error("اسم ورمز القالب مطلوبان");
  const existing = (id && mongoose.Types.ObjectId.isValid(id) ? await CommunicationTemplate.findById(id) : null) as unknown as TemplateRecord | null;
  const template: TemplateRecord | null = existing
    ? await CommunicationTemplate.findByIdAndUpdate(id, { ...payload, $inc: { version: 1 }, $push: { versionHistory: { version: existing.version, subject: existing.subject, content: existing.content, arabicContent: existing.arabicContent, changedBy: userId, changedAt: new Date() } } }, { new: true })
    : await CommunicationTemplate.create({ ...payload, createdBy: userId });
  await recordAudit({ userId, action: existing ? "communication.template.updated" : "communication.template.created", recordType: "communication_template", recordId: template?._id.toString(), metadata: { code: payload.code, channel: payload.channel } });
  return { template };
}

export async function communicationDashboardStats() {
  await connectDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [sentToday, scheduled, failedDeliveries, unreadNotifications, attendanceAlerts, paymentReminders, recent] = await Promise.all([
    Communication.countDocuments({ createdAt: { $gte: today }, status: { $in: ["sent", "delivered", "partially_sent"] } }),
    Communication.countDocuments({ status: "scheduled" }),
    CommunicationDelivery.countDocuments({ status: "failed" }),
    import("@/models/Notification").then(({ default: Notification }) => Notification.countDocuments({ createdAt: { $gte: today }, readBy: { $size: 0 } })),
    Communication.countDocuments({ createdAt: { $gte: today }, category: { $in: ["attendance_absence", "attendance_lateness", "attendance"] } }),
    Communication.countDocuments({ createdAt: { $gte: today }, category: { $in: ["payment_due", "payment_overdue", "payment_reminder"] } }),
    Communication.find().sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  return { sentToday, scheduled, failedDeliveries, unreadNotifications, attendanceAlerts, paymentReminders, recent: (recent as unknown as AnyRecord[]).map((item) => formatCommunication(item as unknown as LeanRecord)) };
}

export { Communication, CommunicationDelivery, CommunicationPreference, CommunicationProviderSetting, CommunicationTemplate };



