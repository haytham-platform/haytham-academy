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
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { csvResponse, toCsv } from "@/lib/academic";

const models = {
  seasons: AcademicSeason,
  students: User,
  enrollments: Enrollment,
  courses: Course,
  teachers: Teacher,
  transportation: TransportSubscription,
  kindergarten: KindergartenRegistration,
} as const;

interface ArchiveModel {
  find(filter: Record<string, unknown>): {
    sort(sort: Record<string, 1 | -1>): {
      skip(skip: number): {
        limit(limit: number): { lean(): Promise<Record<string, unknown>[]> };
      };
      limit(limit: number): { lean(): Promise<Record<string, unknown>[]> };
    };
  };
  countDocuments(filter: Record<string, unknown>): Promise<number>;
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("archive.view");
    if (error) return error;
    await connectDB();
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "students") as keyof typeof models;
    const Model = (models[type] ?? User) as unknown as ArchiveModel;
    const pagination = parsePagination(searchParams, 20);
    const search = searchParams.get("search")?.trim();
    const filter: Record<string, unknown> = type === "seasons" ? { status: "archived" } : type === "enrollments" ? { status: "archived" } : { $or: [{ deletedAt: { $ne: null } }, { status: "archived" }] };
    if (type === "students") filter.role = "student";
    if (search) {
      filter.$and = [
        { $or: Array.isArray(filter.$or) ? filter.$or : [filter] },
        { $or: [{ name: { $regex: search, $options: "i" } }, { title: { $regex: search, $options: "i" } }, { code: { $regex: search, $options: "i" } }, { childName: { $regex: search, $options: "i" } }] },
      ];
      delete filter.$or;
    }
    const exportFormat = searchParams.get("export");
    const limit = exportFormat === "csv" ? 1000 : pagination.limit;
    const [records, total] = await Promise.all([
      Model.find(filter).sort({ archivedAt: -1, deletedAt: -1, updatedAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      Model.countDocuments(filter),
    ]);
    if (exportFormat === "csv") {
      const exportRows = await Model.find(filter).sort({ archivedAt: -1, deletedAt: -1, updatedAt: -1 }).limit(limit).lean();
      return csvResponse(`archive-${type}.csv`, toCsv(["المعرف", "الاسم", "الحالة", "تاريخ الأرشفة", "السبب"], exportRows.map((record) => [
        String(record._id ?? ""),
        String(record.name || record.title || record.childName || record.code || ""),
        String(record.status || "archived"),
        String(record.archivedAt || record.deletedAt || ""),
        String(record.archiveReason || ""),
      ])));
    }
    return successResponse({ type, records, pagination: buildPaginationMeta(total, pagination) });
  } catch (err) {
    console.error("Archive GET:", err);
    return errorResponse("تعذر تحميل الأرشيف", 500);
  }
}
