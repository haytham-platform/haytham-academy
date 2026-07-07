import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { hashPassword } from "@/lib/auth";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { formatStudent, notDeletedFilter } from "@/lib/academic";
import {
  buildPaginationMeta,
  parsePagination,
  parseSort,
} from "@/lib/pagination";

function buildStudentFilter(searchParams: URLSearchParams) {
  const search = searchParams.get("search")?.trim();
  const gender = searchParams.get("gender");
  const wilaya = searchParams.get("wilaya")?.trim();
  const studyLevel = searchParams.get("studyLevel")?.trim();
  const isActive = searchParams.get("isActive");
  const deletedOnly = searchParams.get("deletedOnly") === "true";
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  const filter: Record<string, unknown> = {
    role: "student",
    ...(deletedOnly ? { deletedAt: { $ne: null } } : notDeletedFilter(includeDeleted)),
  };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }
  if (gender === "male" || gender === "female") filter.gender = gender;
  if (wilaya) filter.wilaya = { $regex: wilaya, $options: "i" };
  if (studyLevel) filter.studyLevel = { $regex: studyLevel, $options: "i" };
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;

  return filter;
}

export async function GET(request: Request) {
  try {
    const { error } = await requirePermission("students.view");
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const sort = parseSort(searchParams, ["name", "createdAt", "wilaya"], "createdAt");
    const filter = buildStudentFilter(searchParams);

    await connectDB();

    const [students, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort(sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return successResponse({
      students: students.map((s) => formatStudent(s)),
      pagination: buildPaginationMeta(total, pagination),
    });
  } catch (err) {
    console.error("Admin students GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { error } = await requirePermission("students.manage");
    if (error) return error;

    const body = await request.json();
    if (!body.name?.trim()) return errorResponse("الاسم مطلوب");
    if (!body.phone?.trim()) return errorResponse("رقم الهاتف مطلوب");

    const password = body.password?.trim() || "Student123";
    if (password.length < 6) {
      return errorResponse("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    }

    await connectDB();

    if (body.phone) {
      const exists = await User.findOne({ phone: body.phone.trim() });
      if (exists) return errorResponse("رقم الهاتف مسجل مسبقاً", 409);
    }

    const student = await User.create({
      name: body.name.trim(),
      phone: body.phone.trim(),
      password: await hashPassword(password),
      role: "student",
      isActive: body.isActive !== false,
      gender: body.gender === "male" || body.gender === "female" ? body.gender : undefined,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      guardianName: body.guardianName?.trim(),
      guardianPhone: body.guardianPhone?.trim(),
      address: body.address?.trim(),
      wilaya: body.wilaya?.trim(),
      commune: body.commune?.trim(),
      studyLevel: body.studyLevel?.trim(),
      institution: body.institution?.trim(),
      notes: body.notes?.trim() || "",
    });

    return successResponse({ student: formatStudent(student.toObject()) }, 201);
  } catch (err) {
    return handleRouteError("Admin students POST", err);
  }
}
