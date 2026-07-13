import User from "@/models/User";
import Enrollment from "@/models/Enrollment";
import Course from "@/models/Course";
import Teacher from "@/models/Teacher";
import TransportSubscription from "@/models/TransportSubscription";
import KindergartenRegistration from "@/models/Kindergarten";
import AcademicSeason from "@/models/AcademicSeason";
import { errorResponse, successResponse } from "@/lib/api-response";
import { requirePermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

const models = {
  seasons: AcademicSeason,
  students: User,
  enrollments: Enrollment,
  courses: Course,
  teachers: Teacher,
  transportation: TransportSubscription,
  kindergarten: KindergartenRegistration,
} as const;

interface RestoreModel {
  findByIdAndUpdate(id: string, update: Record<string, unknown>, options: { returnDocument: "after" }): Promise<{ _id: unknown } | null>;
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("archive.restore");
    if (error) return error;
    const body = await request.json();
    const type = String(body.type || "students") as keyof typeof models;
    const id = String(body.id || "");
    const Model = models[type] as unknown as RestoreModel | undefined;
    if (!Model || !id) return errorResponse("طلب استعادة غير صالح", 400);
    await connectDB();
    const update: Record<string, unknown> = { deletedAt: null };
    if (type === "seasons") Object.assign(update, { status: "closed", isArchived: false, isClosed: true, restoredAt: new Date(), restoredBy: user!._id });
    if (type === "students") Object.assign(update, { status: "active", isActive: true });
    if (type === "courses") Object.assign(update, { isActive: true });
    if (type === "teachers") Object.assign(update, { status: "active", isActive: true });
    if (type === "kindergarten") Object.assign(update, { status: "active" });
    if (type === "enrollments") Object.assign(update, { status: "pending" });
    if (type === "transportation") Object.assign(update, { status: "active" });
    const record = await Model.findByIdAndUpdate(id, update, { returnDocument: "after" });
    if (!record) return errorResponse("السجل غير موجود", 404);
    await recordAudit({ userId: user!._id, action: "archive.restore", recordType: type, recordId: id, metadata: { reason: body.reason || "" } });
    return successResponse({ record });
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر استعادة السجل";
    return errorResponse(message, 400);
  }
}
