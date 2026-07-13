import crypto from "node:crypto";
import mongoose from "mongoose";
import AcademicSeason, { type AcademicSeasonStatus } from "@/models/AcademicSeason";
import RolloverJob, { type RolloverAction, type IRolloverConflict } from "@/models/RolloverJob";
import User from "@/models/User";
import Enrollment from "@/models/Enrollment";
import Course from "@/models/Course";
import Route from "@/models/Route";
import KindergartenRegistration from "@/models/Kindergarten";
import TransportSubscription from "@/models/TransportSubscription";
import { PrivateLesson } from "@/models/PrivateLesson";
import { StudentAttendance, StudentPerformance } from "@/models/StudentRecords";
import { StudentCharge, StudentFeeConfig } from "@/models/StudentFinance";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { recordAudit, recordFinancialAudit } from "@/lib/audit";
import { statusToIsActive } from "@/lib/students";

type AnyRecord = Record<string, unknown>;

const SEASON_STATUSES: AcademicSeasonStatus[] = ["draft", "upcoming", "active", "closed", "archived"];
const ROLLOVER_ACTIONS: RolloverAction[] = ["promote", "repeat", "transfer", "graduate", "withdraw", "archive", "keep", "move_class", "move_group", "exclude"];

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function date(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function objectId(value: unknown) {
  const str = String(value || "");
  return mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : null;
}

function action(value: unknown): RolloverAction {
  return ROLLOVER_ACTIONS.includes(value as RolloverAction) ? value as RolloverAction : "promote";
}

function severity(code: string): "blocking" | "warning" {
  return [
    "missing_target_season",
    "closed_target_season",
    "archived_target_season",
    "duplicate_rollover",
    "already_enrolled_target",
    "already_graduated",
    "already_archived",
    "missing_target_level",
    "missing_target_class",
    "invalid_target_level",
  ].includes(code) ? "blocking" : "warning";
}

function conflict(code: string, message: string): IRolloverConflict {
  return { code, message, severity: severity(code) };
}

function seasonPayload(body: AnyRecord, userId: string, update = false) {
  const startDate = date(body.startDate);
  const endDate = date(body.endDate);
  if (!update || body.name !== undefined) {
    if (!trim(body.name)) throw new Error("اسم الموسم مطلوب");
  }
  if (!update || body.code !== undefined) {
    if (!trim(body.code)) throw new Error("رمز الموسم مطلوب");
  }
  if ((!update || body.startDate !== undefined) && !startDate) throw new Error("تاريخ البداية غير صالح");
  if ((!update || body.endDate !== undefined) && !endDate) throw new Error("تاريخ النهاية غير صالح");
  if (startDate && endDate && startDate > endDate) throw new Error("تاريخ بداية الموسم يجب أن يسبق تاريخ نهايته");

  const status = trim(body.status) as AcademicSeasonStatus;
  const payload: AnyRecord = {};
  if (body.name !== undefined) payload.name = trim(body.name);
  if (body.code !== undefined) payload.code = trim(body.code).toUpperCase();
  if (startDate) payload.startDate = startDate;
  if (endDate) payload.endDate = endDate;
  if (SEASON_STATUSES.includes(status)) payload.status = status;
  if (body.isOpenForRegistration !== undefined) payload.isOpenForRegistration = body.isOpenForRegistration === true;
  if (body.description !== undefined) payload.description = trim(body.description);
  if (body.notes !== undefined) payload.notes = trim(body.notes);
  if (body.configuration && typeof body.configuration === "object") payload.configuration = body.configuration;
  payload.updatedBy = userId;
  return payload;
}

export async function listAcademicSeasons(searchParams: URLSearchParams) {
  const pagination = parsePagination(searchParams, 20);
  const filter: AnyRecord = {};
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();
  if (status && SEASON_STATUSES.includes(status as AcademicSeasonStatus)) filter.status = status;
  if (search) filter.$or = [{ name: { $regex: search, $options: "i" } }, { code: { $regex: search, $options: "i" } }];
  const [rows, total] = await Promise.all([
    AcademicSeason.find(filter).sort({ isCurrent: -1, startDate: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    AcademicSeason.countDocuments(filter),
  ]);
  return { seasons: rows, pagination: buildPaginationMeta(total, pagination) };
}

export async function createAcademicSeason(body: AnyRecord, userId: string) {
  const payload = seasonPayload(body, userId);
  const copyFromSeason = trim(body.copyFromSeason);
  if (copyFromSeason) {
    payload.configuration = await copyConfiguration(copyFromSeason);
  }
  const season = await AcademicSeason.create({ ...payload, createdBy: userId });
  await recordAudit({ userId, action: "academic_season.create", recordType: "academic_season", recordId: season._id.toString(), metadata: { code: season.code } });
  return season;
}

export async function updateAcademicSeason(id: string, body: AnyRecord, userId: string) {
  const season = await AcademicSeason.findById(id);
  if (!season) throw new Error("الموسم غير موجود");
  if (season.status !== "draft" && season.status !== "upcoming") throw new Error("يمكن تعديل المواسم المسودة أو القادمة فقط");
  const previous = season.toObject();
  Object.assign(season, seasonPayload(body, userId, true));
  await season.save();
  await recordAudit({ userId, action: "academic_season.update", recordType: "academic_season", recordId: season._id.toString(), metadata: { previous, next: season.toObject() } });
  return season;
}

export async function transitionAcademicSeason(id: string, transition: string, body: AnyRecord, userId: string) {
  const season = await AcademicSeason.findById(id);
  if (!season) throw new Error("الموسم غير موجود");
  const previous = season.toObject();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (transition === "activate") {
        if (season.status === "archived") throw new Error("لا يمكن تفعيل موسم مؤرشف");
        await AcademicSeason.updateMany({ _id: { $ne: season._id }, isCurrent: true }, { isCurrent: false, status: "closed", isClosed: true, isOpenForRegistration: false, closedAt: new Date(), closedBy: userId }, { session });
        season.status = "active";
        season.isCurrent = true;
        season.isClosed = false;
        season.isArchived = false;
        season.isOpenForRegistration = body.isOpenForRegistration !== false;
      }
      if (transition === "close") {
        season.status = "closed";
        season.isCurrent = false;
        season.isClosed = true;
        season.isOpenForRegistration = false;
        season.closedAt = new Date();
        season.closedBy = objectId(userId) ?? undefined;
      }
      if (transition === "reopen") {
        if (season.status !== "closed") throw new Error("يمكن إعادة فتح موسم مغلق فقط");
        season.status = "upcoming";
        season.isClosed = false;
        season.isOpenForRegistration = body.isOpenForRegistration === true;
        season.reopenedAt = new Date();
        season.reopenedBy = objectId(userId) ?? undefined;
      }
      if (transition === "archive") {
        season.status = "archived";
        season.isCurrent = false;
        season.isClosed = true;
        season.isArchived = true;
        season.isOpenForRegistration = false;
        season.archivedAt = new Date();
        season.archivedBy = objectId(userId) ?? undefined;
        season.archiveReason = trim(body.reason);
      }
      if (transition === "restore") {
        if (season.status !== "archived") throw new Error("يمكن استعادة موسم مؤرشف فقط");
        season.status = "closed";
        season.isArchived = false;
        season.isClosed = true;
        season.restoredAt = new Date();
        season.restoredBy = objectId(userId) ?? undefined;
      }
      season.updatedBy = objectId(userId) ?? undefined;
      await season.save({ session });
    });
  } finally {
    await session.endSession();
  }
  await recordAudit({ userId, action: `academic_season.${transition}`, recordType: "academic_season", recordId: season._id.toString(), metadata: { previous, next: season.toObject(), reason: trim(body.reason) } });
  return season;
}

export async function copyConfiguration(seasonCode: string) {
  const [levels, classes, groups, courses, fees, routes, kindergartenGroups] = await Promise.all([
    User.distinct("academicLevel", { role: "student", academicSeason: seasonCode, academicLevel: { $nin: [null, ""] } }),
    User.distinct("className", { role: "student", academicSeason: seasonCode, className: { $nin: [null, ""] } }),
    User.distinct("groupName", { role: "student", academicSeason: seasonCode, groupName: { $nin: [null, ""] } }),
    Course.find({ deletedAt: null }).select("_id").lean(),
    StudentFeeConfig.find({ season: seasonCode, isActive: true }).select("_id").lean(),
    Route.find({ deletedAt: null, status: "active" }).select("_id").lean(),
    KindergartenRegistration.distinct("groupName", { deletedAt: null, groupName: { $nin: [null, ""] } }),
  ]);
  return {
    academicLevels: levels.filter(Boolean),
    classes: classes.filter(Boolean),
    groups: groups.filter(Boolean),
    courseIds: courses.map((row) => row._id),
    feeConfigIds: fees.map((row) => row._id),
    routeIds: routes.map((row) => row._id),
    kindergartenGroups: kindergartenGroups.filter(Boolean),
    teacherAssignmentTemplates: [],
    scheduleTemplates: [],
  };
}

function scopeFilter(scope: AnyRecord, sourceSeason: string) {
  const filter: AnyRecord = { role: "student", deletedAt: null, academicSeason: sourceSeason };
  if (Array.isArray(scope.studentIds) && scope.studentIds.length) filter._id = { $in: scope.studentIds.map(objectId).filter(Boolean) };
  if (trim(scope.academicLevel)) filter.academicLevel = trim(scope.academicLevel);
  if (trim(scope.className)) filter.className = trim(scope.className);
  if (trim(scope.groupName)) filter.groupName = trim(scope.groupName);
  if (trim(scope.enrollmentType)) filter.enrollmentType = trim(scope.enrollmentType);
  return filter;
}

async function studentPreview(student: AnyRecord, sourceSeason: string, targetSeason: string, target: AnyRecord, itemAction: RolloverAction) {
  const studentId = objectId(student._id);
  const targetSeasonDoc = await AcademicSeason.findOne({ code: targetSeason }).lean();
  const [sourceEnrollment, targetEnrollment, rolledJob, charges, attendance, performance, transport, kindergarten, privateLessons] = await Promise.all([
    Enrollment.findOne({ student: studentId, academicSeason: sourceSeason, status: { $in: ["pending", "approved", "accepted", "reactivated"] } }).sort({ createdAt: -1 }).lean(),
    Enrollment.findOne({ student: studentId, academicSeason: targetSeason, status: { $in: ["pending", "approved", "accepted", "reactivated"] } }).lean(),
    RolloverJob.exists({ targetSeason, "items.studentId": studentId, "items.status": "completed" }),
    StudentCharge.aggregate([{ $match: { studentId, academicSeason: sourceSeason, status: { $nin: ["cancelled", "paid", "exempted"] } } }, { $group: { _id: null, balance: { $sum: "$balanceMinor" } } }]),
    StudentAttendance.aggregate([{ $match: { studentId, academicSeason: sourceSeason } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    StudentPerformance.findOne({ studentId, academicSeason: sourceSeason }).sort({ createdAt: -1 }).lean(),
    TransportSubscription.findOne({ studentId, status: "active" }).lean(),
    KindergartenRegistration.findOne({ childId: studentId, deletedAt: null, status: "active" }).lean(),
    PrivateLesson.countDocuments({ "students.studentId": studentId, deletedAt: null, status: { $in: ["scheduled", "confirmed", "in_progress"] } }),
  ]);
  const targetAcademicLevel = trim(target.academicLevel) || String(student.academicLevel || student.studyLevel || "");
  const targetClass = trim(target.className) || String(student.className || "");
  const targetGroup = trim(target.groupName) || String(student.groupName || "");
  const conflicts = [];
  if (!targetSeasonDoc) conflicts.push(conflict("missing_target_season", "الموسم الهدف غير موجود"));
  if (targetSeasonDoc?.status === "closed") conflicts.push(conflict("closed_target_season", "الموسم الهدف مغلق"));
  if (targetSeasonDoc?.status === "archived") conflicts.push(conflict("archived_target_season", "الموسم الهدف مؤرشف"));
  if (rolledJob) conflicts.push(conflict("duplicate_rollover", "تم ترحيل هذا الطالب مسبقا إلى الموسم الهدف"));
  if (targetEnrollment) conflicts.push(conflict("already_enrolled_target", "الطالب مسجل مسبقا في الموسم الهدف"));
  if (student.status === "graduated") conflicts.push(conflict("already_graduated", "الطالب متخرج مسبقا"));
  if (student.status === "archived" || student.deletedAt) conflicts.push(conflict("already_archived", "الطالب مؤرشف"));
  if (!targetAcademicLevel && !["graduate", "withdraw", "archive", "exclude"].includes(itemAction)) conflicts.push(conflict("missing_target_level", "المستوى الهدف غير محدد"));
  if (!targetClass && ["transfer", "move_class"].includes(itemAction)) conflicts.push(conflict("missing_target_class", "القسم الهدف غير محدد"));
  if (transport && target.transportation === "continue") conflicts.push(conflict("duplicate_transportation_assignment", "يوجد اشتراك نقل نشط ويحتاج مراجعة قبل نسخه"));
  if (kindergarten && target.kindergarten === "continue") conflicts.push(conflict("duplicate_kindergarten_registration", "يوجد تسجيل روضة نشط ويحتاج مراجعة قبل فتح اشتراك جديد"));
  const warnings = conflicts.filter((row) => row.severity === "warning");
  const blocking = conflicts.filter((row) => row.severity === "blocking");
  const balanceMinor = charges[0]?.balance ?? 0;
  if (balanceMinor > 0) warnings.push(conflict("outstanding_balance", "يوجد رصيد مالي مستحق في الموسم المصدر"));
  if (privateLessons > 0) warnings.push(conflict("future_private_lessons", "لدى الطالب حصص خاصة مستقبلية تحتاج مراجعة"));
  return {
    studentId,
    sourceEnrollmentId: sourceEnrollment?._id,
    sourceAcademicLevel: String(student.academicLevel || student.studyLevel || ""),
    targetAcademicLevel,
    sourceClass: String(student.className || ""),
    targetClass,
    sourceGroup: String(student.groupName || ""),
    targetGroup,
    enrollmentType: String(student.enrollmentType || sourceEnrollment?.enrollmentType || ""),
    action: itemAction,
    status: "pending",
    conflicts: blocking,
    warnings,
    preview: {
      studentName: student.name,
      sourceSeason,
      targetSeason,
      activeEnrollment: sourceEnrollment?._id?.toString() ?? "",
      financialBalance: Math.round(balanceMinor / 100),
      attendanceSummary: Object.fromEntries(attendance.map((row) => [row._id || "unknown", row.count])),
      academicResult: performance ? Math.round((Number(performance.score) / Number(performance.maxScore || 1)) * 100) : null,
      transportationStatus: transport?.status ?? "none",
      kindergartenStatus: kindergarten?.status ?? "none",
      privateLessonStatus: privateLessons > 0 ? "active_future_lessons" : "none",
      proposedAction: itemAction,
    },
  };
}

export async function createRolloverPreview(body: AnyRecord, userId: string) {
  const sourceSeason = trim(body.sourceSeason);
  const targetSeason = trim(body.targetSeason);
  if (!sourceSeason || !targetSeason || sourceSeason === targetSeason) throw new Error("يجب تحديد موسم مصدر وموسم هدف مختلفين");
  const scope = (body.scope && typeof body.scope === "object" ? body.scope : {}) as AnyRecord;
  const target = (body.target && typeof body.target === "object" ? body.target : {}) as AnyRecord;
  const itemAction = action(body.action);
  const filter = scopeFilter(scope, sourceSeason);
  const students = await User.find(filter).select("-password").sort({ className: 1, name: 1 }).limit(2000).lean();
  const items = [];
  for (const student of students) {
    if (itemAction === "exclude") {
      items.push({ studentId: student._id, action: itemAction, status: "skipped", conflicts: [], warnings: [], preview: { studentName: student.name, proposedAction: itemAction } });
    } else {
      items.push(await studentPreview(student as unknown as AnyRecord, sourceSeason, targetSeason, target, itemAction));
    }
  }
  const idempotencyKey = trim(body.idempotencyKey) || crypto.createHash("sha256").update(JSON.stringify({ sourceSeason, targetSeason, scope, target, itemAction, userId, t: Date.now() })).digest("hex");
  const warnings = items.reduce((sum, item) => sum + item.warnings.length, 0);
  const blocking = items.reduce((sum, item) => sum + item.conflicts.length, 0);
  const job = await RolloverJob.findOneAndUpdate(
    { idempotencyKey },
    {
      sourceSeason,
      targetSeason,
      sourceSeasonId: objectId(body.sourceSeasonId) ?? undefined,
      targetSeasonId: objectId(body.targetSeasonId) ?? undefined,
      scope,
      action: itemAction,
      items,
      totalStudents: items.length,
      warnings,
      status: blocking ? "previewed" : "ready",
      createdBy: userId,
      idempotencyKey,
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  await recordAudit({ userId, action: "academic_season.rollover_preview", recordType: "rollover_job", recordId: job._id.toString(), metadata: { sourceSeason, targetSeason, total: items.length, blocking, warnings } });
  return job;
}

export async function executeRolloverJob(jobId: string, body: AnyRecord, userId: string) {
  const job = await RolloverJob.findById(jobId);
  if (!job) throw new Error("مهمة الترحيل غير موجودة");
  if (!["previewed", "ready", "failed", "completed_with_warnings"].includes(job.status)) throw new Error("لا يمكن تنفيذ هذه المهمة في حالتها الحالية");
  const blocking = job.items.flatMap((item) => item.conflicts || []);
  if (blocking.length) throw new Error("لا يمكن التنفيذ قبل معالجة التعارضات الحرجة");
  const overrideWarnings = body.overrideWarnings === true;
  if (job.warnings > 0 && overrideWarnings && !trim(body.overrideReason)) throw new Error("سبب تجاوز التحذيرات مطلوب");
  if (job.warnings > 0 && !overrideWarnings) throw new Error("توجد تحذيرات تتطلب موافقة صريحة");

  const locked = await RolloverJob.findOneAndUpdate({ _id: job._id, status: { $in: ["previewed", "ready", "failed", "completed_with_warnings"] } }, { status: "running", startedAt: new Date(), startedBy: userId, overrideWarnings, overrideReason: trim(body.overrideReason) }, { returnDocument: "after" });
  if (!locked) throw new Error("تعذر قفل مهمة الترحيل للتنفيذ");

  const session = await mongoose.startSession();
  const failures: string[] = [];
  let completed = 0;
  let skipped = 0;
  try {
    await session.withTransaction(async () => {
      for (const item of locked.items) {
        try {
          if (item.action === "exclude" || item.status === "skipped") {
            item.status = "skipped";
            skipped += 1;
            continue;
          }
          const student = await User.findById(item.studentId).session(session);
          if (!student) throw new Error("الطالب غير موجود");
          if (["graduate", "withdraw", "archive"].includes(item.action)) {
            student.status = item.action === "graduate" ? "graduated" : item.action === "withdraw" ? "withdrawn" : "archived";
            student.isActive = statusToIsActive(student.status);
            if (item.action === "archive") student.deletedAt = new Date();
            await student.save({ session });
          } else {
            student.academicSeason = locked.targetSeason;
            student.academicLevel = item.targetAcademicLevel || student.academicLevel;
            student.studyLevel = item.targetAcademicLevel || student.studyLevel;
            student.className = item.targetClass || student.className;
            student.groupName = item.targetGroup || student.groupName;
            student.status = "active";
            student.isActive = true;
            await student.save({ session });
            const sourceEnrollment = item.sourceEnrollmentId ? await Enrollment.findById(item.sourceEnrollmentId).session(session) : null;
            if (sourceEnrollment) {
              const exists = await Enrollment.exists({ student: student._id, course: sourceEnrollment.course, academicSeason: locked.targetSeason }).session(session);
              if (!exists) {
                const [targetEnrollment] = await Enrollment.create([{
                  student: student._id,
                  course: sourceEnrollment.course,
                  status: "pending",
                  note: `تم إنشاؤه من ترحيل الموسم ${locked.sourceSeason}`,
                  academicSeason: locked.targetSeason,
                  academicLevel: item.targetAcademicLevel,
                  className: item.targetClass,
                  enrollmentType: item.enrollmentType,
                  registrationFee: sourceEnrollment.registrationFee,
                  tuitionFee: sourceEnrollment.tuitionFee,
                  discount: 0,
                  finalPrice: sourceEnrollment.finalPrice,
                  paymentPlan: sourceEnrollment.paymentPlan,
                  startDate: new Date(),
                  subjects: sourceEnrollment.subjects,
                  teachers: sourceEnrollment.teachers,
                  createdBy: userId,
                }], { session });
                item.targetEnrollmentId = targetEnrollment._id;
              }
            }
          }
          item.status = "completed";
          item.executedAt = new Date();
          completed += 1;
          await recordAudit({ userId, action: `academic_season.student_${item.action}`, recordType: "student", recordId: item.studentId.toString(), metadata: { sourceSeason: locked.sourceSeason, targetSeason: locked.targetSeason, rolloverJobId: locked._id.toString(), preview: item.preview } });
        } catch (error) {
          item.status = "failed";
          item.error = error instanceof Error ? error.message : "فشل غير معروف";
          failures.push(`${item.studentId}: ${item.error}`);
        }
      }
      locked.completed = completed;
      locked.skipped = skipped;
      locked.failed = failures.length;
      locked.status = failures.length ? "failed" : locked.warnings ? "completed_with_warnings" : "completed";
      locked.completedAt = new Date();
      locked.executedBy = objectId(userId) ?? undefined;
      locked.errorSummary = failures.slice(0, 10).join("\n");
      await locked.save({ session });
    });
  } finally {
    await session.endSession();
  }
  await recordAudit({ userId, action: "academic_season.rollover_execute", recordType: "rollover_job", recordId: locked._id.toString(), metadata: { sourceSeason: locked.sourceSeason, targetSeason: locked.targetSeason, completed, failed: failures.length, skipped, overrideWarnings, overrideReason: trim(body.overrideReason) } });
  return locked;
}

export async function createOpeningBalance(body: AnyRecord, userId: string) {
  const studentId = objectId(body.studentId);
  if (!studentId) throw new Error("الطالب مطلوب");
  const sourceSeason = trim(body.sourceSeason);
  const targetSeason = trim(body.targetSeason);
  const amountMinor = Math.round(Number(body.amount || 0) * 100);
  if (!sourceSeason || !targetSeason || amountMinor <= 0) throw new Error("بيانات الرصيد الافتتاحي غير صالحة");
  const duplicateKey = `opening:${sourceSeason}:${targetSeason}:${studentId.toString()}`;
  const charge = await StudentCharge.findOneAndUpdate(
    { duplicateKey },
    {
      studentId,
      academicSeason: targetSeason,
      chargeType: "other",
      description: `رصيد افتتاحي مرحل من موسم ${sourceSeason}`,
      originalAmountMinor: amountMinor,
      discountAmountMinor: 0,
      finalAmountMinor: amountMinor,
      paidAmountMinor: 0,
      refundedAmountMinor: 0,
      balanceMinor: amountMinor,
      dueDate: date(body.dueDate) ?? new Date(),
      status: "pending",
      relatedRecordType: "season_opening_balance",
      duplicateKey,
      allowDuplicate: false,
      createdBy: userId,
      notes: trim(body.reason),
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  await recordFinancialAudit({ userId, action: "academic_season.opening_balance.create", recordType: "student_charge", recordId: charge._id.toString(), metadata: { sourceSeason, targetSeason, amountMinor, reason: trim(body.reason) } });
  return charge;
}
