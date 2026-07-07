import { connectDB } from "@/lib/db";
import Teacher from "@/models/Teacher";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { formatTeacher, notDeletedFilter } from "@/lib/academic";
import {
  buildPaginationMeta,
  parsePagination,
  parseSort,
} from "@/lib/pagination";

function parseAdminShare(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function buildTeacherFilter(searchParams: URLSearchParams) {
  const search = searchParams.get("search")?.trim();
  const subject = searchParams.get("subject")?.trim();
  const isActive = searchParams.get("isActive");
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  const filter: Record<string, unknown> = notDeletedFilter(includeDeleted);

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
      { teachingLevel: { $regex: search, $options: "i" } },
    ];
  }
  if (subject) filter.subject = { $regex: subject, $options: "i" };
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;

  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("teachers.manage");
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["name", "createdAt", "subject"], "createdAt");
    const filter = buildTeacherFilter(searchParams);

    await connectDB();

    const [teachers, total] = await Promise.all([
      Teacher.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
      Teacher.countDocuments(filter),
    ]);

    return successResponse({
      teachers: teachers.map((t) => formatTeacher(t)),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Admin teachers GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requirePermission("teachers.manage");
    if (error) return error;

    const body = await request.json();

    if (!body.name?.trim()) return errorResponse("اسم الأستاذ مطلوب");
    if (!body.phone?.trim()) return errorResponse("رقم الهاتف مطلوب");
    if (!body.subject?.trim()) return errorResponse("المادة مطلوبة");
    if (!body.teachingLevel?.trim()) {
      return errorResponse("السنة/المستوى الذي يدرّسه الأستاذ مطلوب");
    }

    const adminShare = parseAdminShare(body.adminShare);
    if (adminShare === null) {
      return errorResponse("نسبة الإدارة يجب أن تكون بين 0 و 100");
    }

    await connectDB();

    const teacher = await Teacher.create({
      name: body.name.trim(),
      subject: body.subject.trim(),
      phone: body.phone.trim(),
      teachingLevel: body.teachingLevel.trim(),
      adminShare,
    });

    return successResponse({ teacher: formatTeacher(teacher) }, 201);
  } catch (err) {
    console.error("Admin teachers POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
