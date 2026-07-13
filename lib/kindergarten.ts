import mongoose from "mongoose";
import KindergartenRegistration, {
  type IKindergartenRegistration,
  type KindergartenPaymentStatus,
  type KindergartenPaymentType,
  type KindergartenRegistrationStatus,
  type KindergartenSubscriptionType,
} from "@/models/Kindergarten";
import Teacher from "@/models/Teacher";
import { connectDB } from "@/lib/db";
import { amountToMinor, minorToAmount } from "@/lib/student-finance";
import { recordFinancialAudit } from "@/lib/audit";

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: unknown, fallback = new Date()) {
  const date = value ? new Date(String(value)) : fallback;
  return Number.isNaN(date.getTime()) ? null : date;
}

function objectId(value: unknown) {
  const str = String(value || "");
  return mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : null;
}

function paymentStatus(totalMinor: number, paidMinor: number, overdue = false): KindergartenPaymentStatus {
  if (totalMinor <= 0 || paidMinor >= totalMinor) return "paid";
  if (overdue && paidMinor < totalMinor) return "overdue";
  return paidMinor > 0 ? "partially_paid" : "unpaid";
}

function periodIsOver(period: string) {
  const text = period.trim();
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date < new Date();
  const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const end = new Date(Number(monthMatch[1]), Number(monthMatch[2]), 0, 23, 59, 59, 999);
    return end < new Date();
  }
  return false;
}

function recalculate(registration: IKindergartenRegistration) {
  registration.registrationPaidMinor = Math.min(registration.registrationPaidMinor, registration.registrationFeeMinor);
  registration.subscriptionPaidMinor = Math.min(registration.subscriptionPaidMinor, registration.subscriptionPriceMinor);
  registration.registrationRemainingMinor = Math.max(0, registration.registrationFeeMinor - registration.registrationPaidMinor);
  registration.subscriptionRemainingMinor = Math.max(0, registration.subscriptionPriceMinor - registration.subscriptionPaidMinor);
  registration.registrationPaymentStatus = paymentStatus(registration.registrationFeeMinor, registration.registrationPaidMinor);
  registration.subscriptionPaymentStatus = paymentStatus(registration.subscriptionPriceMinor, registration.subscriptionPaidMinor, periodIsOver(registration.currentPeriod));
  registration.totalOutstandingMinor = registration.registrationRemainingMinor + registration.subscriptionRemainingMinor;
}

async function ensureScheduleAvailable(body: Record<string, unknown>, excludeId?: mongoose.Types.ObjectId) {
  const teacherId = objectId(body.teacherId);
  if (!teacherId) throw new Error("المربية مطلوبة.");
  const startDate = validDate(body.startDate);
  const startTime = trim(body.startTime);
  const endTime = trim(body.endTime);
  if (!startDate) throw new Error("تاريخ البداية مطلوب.");
  if (!startTime || !endTime || endTime <= startTime) throw new Error("وقت النهاية يجب أن يكون بعد وقت البداية.");
  const base: Record<string, unknown> = {
    deletedAt: null,
    status: { $in: ["active", "suspended"] },
    startDate,
    startTime,
    endTime,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  };
  const [teacherConflict, childConflict] = await Promise.all([
    KindergartenRegistration.exists({ ...base, teacherId }),
    KindergartenRegistration.exists({ ...base, childName: trim(body.childName) }),
  ]);
  if (teacherConflict) throw new Error("المربية لديها تسجيل آخر في هذا التوقيت.");
  if (childConflict) throw new Error("الطفل لديه تسجيل آخر في هذا التوقيت.");
}

export async function generateKindergartenReceiptNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let i = 0; i < 5; i += 1) {
    const receiptNumber = `KG-${datePart}-${new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase()}`;
    const exists = await KindergartenRegistration.exists({ "payments.receiptNumber": receiptNumber });
    if (!exists) return receiptNumber;
  }
  throw new Error("تعذر توليد رقم وصل فريد.");
}

export function formatKindergartenRegistration(row: unknown) {
  const record = row as Record<string, unknown>;
  const teacher = record.teacherId as { _id?: unknown; name?: string } | undefined;
  return {
    _id: String(record._id),
    childId: record.childId?.toString?.() ?? record.childId ?? "",
    childName: record.childName,
    teacherId: teacher?._id?.toString?.() ?? record.teacherId?.toString?.() ?? record.teacherId,
    teacherName: teacher?.name ?? "",
    guardianName: record.guardianName ?? "",
    guardianPhone: record.guardianPhone,
    registrationDate: record.registrationDate,
    startDate: record.startDate,
    groupName: record.groupName,
    attendanceSchedule: record.attendanceSchedule,
    startTime: record.startTime,
    endTime: record.endTime,
    registrationFee: minorToAmount(record.registrationFeeMinor),
    registrationPaid: minorToAmount(record.registrationPaidMinor),
    registrationRemaining: minorToAmount(record.registrationRemainingMinor),
    registrationPaymentStatus: record.registrationPaymentStatus,
    subscriptionType: record.subscriptionType,
    subscriptionPrice: minorToAmount(record.subscriptionPriceMinor),
    currentPeriod: record.currentPeriod,
    subscriptionPaid: minorToAmount(record.subscriptionPaidMinor),
    subscriptionRemaining: minorToAmount(record.subscriptionRemainingMinor),
    subscriptionPaymentStatus: record.subscriptionPaymentStatus,
    totalOutstanding: minorToAmount(record.totalOutstandingMinor),
    status: record.status,
    notes: record.notes ?? "",
    payments: record.payments ?? [],
    subscriptionHistory: record.subscriptionHistory ?? [],
  };
}

export async function listKindergartenRegistrations(searchParams: URLSearchParams) {
  await connectDB();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const filter: Record<string, unknown> = { deletedAt: null };
  const search = trim(searchParams.get("search"));
  if (search) filter.$text = { $search: search };
  for (const key of ["subscriptionType", "status", "groupName"]) {
    const value = trim(searchParams.get(key));
    if (value) filter[key] = value;
  }
  const [rows, total] = await Promise.all([
    KindergartenRegistration.find(filter).populate("teacherId", "name").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    KindergartenRegistration.countDocuments(filter),
  ]);
  return { registrations: rows.map(formatKindergartenRegistration), pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasPrev: page > 1, hasNext: page * limit < total } };
}

export async function createKindergartenRegistration(body: Record<string, unknown>, userId: string) {
  await connectDB();
  const teacherId = objectId(body.teacherId);
  if (!trim(body.childName)) throw new Error("اسم الطفل مطلوب.");
  if (!teacherId) throw new Error("المربية مطلوبة.");
  if (!trim(body.guardianPhone)) throw new Error("هاتف الولي مطلوب.");
  if (!validDate(body.registrationDate)) throw new Error("تاريخ التسجيل مطلوب.");
  if (!validDate(body.startDate)) throw new Error("تاريخ البداية مطلوب.");
  if (!trim(body.groupName || body.group)) throw new Error("الفوج مطلوب.");
  const teacher = await Teacher.findById(teacherId);
  if (!teacher || teacher.deletedAt || !teacher.isActive || teacher.status !== "active") throw new Error("المربية غير متاحة أو أن حالتها لا تسمح بإسناد الطفل إليها.");
  await ensureScheduleAvailable(body);
  const subscriptionType = String(body.subscriptionType || "monthly") as KindergartenSubscriptionType;
  if (!["weekly", "monthly"].includes(subscriptionType)) throw new Error("نوع الاشتراك مطلوب.");
  const registrationFeeMinor = amountToMinor(body.registrationFee) ?? 0;
  const registrationPaidMinor = amountToMinor(body.fileFeePaid ?? body.registrationPaid) ?? 0;
  const subscriptionPriceMinor = amountToMinor(subscriptionType === "weekly" ? body.weeklyPrice : body.monthlyPrice) ?? amountToMinor(body.subscriptionPrice) ?? 0;
  const subscriptionPaidMinor = amountToMinor(body.amountPaid ?? body.subscriptionPaid) ?? 0;
  if (subscriptionPriceMinor <= 0) throw new Error("مبلغ الاشتراك غير صالح.");
  if (registrationPaidMinor > registrationFeeMinor) throw new Error("لا يمكن أن يتجاوز دفع الملف رسوم الملف.");
  if (subscriptionPaidMinor > subscriptionPriceMinor) throw new Error("لا يمكن أن يتجاوز دفع الاشتراك مبلغ الاشتراك.");
  const currentPeriod = trim(subscriptionType === "weekly" ? body.weekPeriod : body.monthPeriod) || trim(body.currentPeriod);
  if (!currentPeriod) throw new Error("فترة الاشتراك غير صالحة.");
  const duplicatePeriod = await KindergartenRegistration.exists({
    childName: trim(body.childName),
    subscriptionType,
    currentPeriod,
    deletedAt: null,
  });
  if (duplicatePeriod) throw new Error("توجد فاتورة لنفس الطفل ونفس فترة الاشتراك.");
  const registration = new KindergartenRegistration({
    childName: trim(body.childName),
    childId: objectId(body.childId) ?? undefined,
    teacherId,
    guardianName: trim(body.guardianName),
    guardianPhone: trim(body.guardianPhone),
    registrationDate: validDate(body.registrationDate) ?? new Date(),
    startDate: validDate(body.startDate) ?? new Date(),
    groupName: trim(body.groupName || body.group),
    attendanceSchedule: trim(body.attendanceSchedule),
    startTime: trim(body.startTime),
    endTime: trim(body.endTime),
    registrationFeeMinor,
    registrationPaidMinor,
    subscriptionType,
    subscriptionPriceMinor,
    currentPeriod,
    subscriptionPaidMinor,
    status: (["active", "suspended", "withdrawn", "completed"].includes(String(body.status)) ? body.status : "active") as KindergartenRegistrationStatus,
    notes: trim(body.notes),
    payments: [],
    subscriptionHistory: [],
    createdBy: userId,
  });
  if (!registration.childName || !registration.guardianPhone || !registration.groupName || !registration.attendanceSchedule || !registration.currentPeriod) {
    throw new Error("فترة الاشتراك غير صالحة.");
  }
  recalculate(registration);
  if (registration.registrationPaidMinor > 0) {
    registration.payments.push({ paymentType: "registration_fee", amountMinor: registration.registrationPaidMinor, paymentDate: new Date(), paymentMethod: "cash", receiptNumber: await generateKindergartenReceiptNumber(), cashierId: new mongoose.Types.ObjectId(userId), idempotencyKey: `initial-file-${registration._id}` });
  }
  if (registration.subscriptionPaidMinor > 0) {
    registration.payments.push({ paymentType: subscriptionType === "weekly" ? "weekly_fee" : "monthly_fee", billingPeriod: registration.currentPeriod, amountMinor: registration.subscriptionPaidMinor, paymentDate: new Date(), paymentMethod: "cash", receiptNumber: await generateKindergartenReceiptNumber(), cashierId: new mongoose.Types.ObjectId(userId), idempotencyKey: `initial-sub-${registration._id}` });
  }
  await registration.save();
  await recordFinancialAudit({ userId, action: "kindergarten.registration.create", recordType: "kindergarten_registration", recordId: registration._id.toString(), metadata: { newValues: formatKindergartenRegistration(registration) } });
  return formatKindergartenRegistration(registration);
}

export async function recordKindergartenPayment(id: string, body: Record<string, unknown>, userId: string) {
  await connectDB();
  const registration = await KindergartenRegistration.findById(id);
  if (!registration) throw new Error("تسجيل الروضة غير موجود.");
  const paymentType = String(body.paymentType || "registration_fee") as KindergartenPaymentType;
  if (!["registration_fee", "weekly_fee", "monthly_fee"].includes(paymentType)) throw new Error("نوع الدفع غير صالح.");
  if (paymentType === "weekly_fee" && registration.subscriptionType !== "weekly") throw new Error("هذا التسجيل ليس أسبوعيا.");
  if (paymentType === "monthly_fee" && registration.subscriptionType !== "monthly") throw new Error("هذا التسجيل ليس شهريا.");
  const amountMinor = amountToMinor(body.amount);
  if (!amountMinor || amountMinor <= 0) throw new Error("مبلغ الدفع غير صالح.");
  const remaining = paymentType === "registration_fee" ? registration.registrationRemainingMinor : registration.subscriptionRemainingMinor;
  if (amountMinor > remaining) throw new Error("لا يمكن أن يتجاوز الدفع الرصيد المتبقي.");
  const idempotencyKey = trim(body.idempotencyKey);
  if (idempotencyKey && registration.payments.some((payment) => payment.idempotencyKey === idempotencyKey)) {
    return formatKindergartenRegistration(registration);
  }
  registration.payments.push({
    paymentType,
    billingPeriod: paymentType === "registration_fee" ? undefined : registration.currentPeriod,
    amountMinor,
    paymentDate: validDate(body.paymentDate) ?? new Date(),
    paymentMethod: String(body.paymentMethod || "cash") as never,
    receiptNumber: await generateKindergartenReceiptNumber(),
    idempotencyKey: idempotencyKey || undefined,
    cashierId: new mongoose.Types.ObjectId(userId),
    notes: trim(body.notes),
  });
  if (paymentType === "registration_fee") registration.registrationPaidMinor += amountMinor;
  else registration.subscriptionPaidMinor += amountMinor;
  recalculate(registration);
  await registration.save();
  await recordFinancialAudit({ userId, action: "kindergarten.payment.create", recordType: "kindergarten_registration", recordId: id, metadata: { paymentType, amount: minorToAmount(amountMinor), receiptNumber: registration.payments.at(-1)?.receiptNumber } });
  return formatKindergartenRegistration(registration);
}

export async function changeKindergartenSubscription(id: string, body: Record<string, unknown>, userId: string) {
  await connectDB();
  const registration = await KindergartenRegistration.findById(id);
  if (!registration) throw new Error("تسجيل الروضة غير موجود.");
  const subscriptionType = String(body.subscriptionType) as KindergartenSubscriptionType;
  if (!["weekly", "monthly"].includes(subscriptionType)) throw new Error("نوع الاشتراك مطلوب.");
  if (!trim(body.reason)) throw new Error("سبب تغيير الاشتراك مطلوب.");
  const priceMinor = amountToMinor(subscriptionType === "weekly" ? body.weeklyPrice : body.monthlyPrice) ?? amountToMinor(body.subscriptionPrice);
  if (priceMinor === null || priceMinor <= 0) throw new Error("مبلغ الاشتراك غير صالح.");
  const period = trim(subscriptionType === "weekly" ? body.weekPeriod : body.monthPeriod) || trim(body.currentPeriod);
  if (!period) throw new Error("فترة الاشتراك غير صالحة.");
  const duplicate = await KindergartenRegistration.exists({
    _id: { $ne: registration._id },
    childName: registration.childName,
    subscriptionType,
    currentPeriod: period,
    deletedAt: null,
  });
  if (duplicate) throw new Error("توجد فاتورة لنفس الطفل ونفس فترة الاشتراك.");
  const previous = { subscriptionType: registration.subscriptionType, subscriptionPriceMinor: registration.subscriptionPriceMinor, currentPeriod: registration.currentPeriod, paidMinor: registration.subscriptionPaidMinor, remainingMinor: registration.subscriptionRemainingMinor };
  registration.subscriptionHistory.push({
    oldSubscription: previous,
    newSubscription: { subscriptionType, subscriptionPriceMinor: priceMinor, currentPeriod: period },
    reason: trim(body.reason),
    changedBy: new mongoose.Types.ObjectId(userId),
    changedAt: new Date(),
  });
  registration.subscriptionType = subscriptionType;
  registration.subscriptionPriceMinor = priceMinor;
  registration.currentPeriod = period;
  registration.subscriptionPaidMinor = 0;
  recalculate(registration);
  await registration.save();
  await recordFinancialAudit({ userId, action: "kindergarten.subscription.change", recordType: "kindergarten_registration", recordId: id, metadata: { previous, next: { subscriptionType, price: minorToAmount(priceMinor), period }, reason: trim(body.reason) } });
  return formatKindergartenRegistration(registration);
}
