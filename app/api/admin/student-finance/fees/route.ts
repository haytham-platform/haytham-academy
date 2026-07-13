import { StudentFeeConfig } from "@/models/StudentFinance";
import { requireStudentFinanceManage, requireStudentFinanceView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { connectDB } from "@/lib/db";
import { amountToMinor, formatStudentFeeConfig } from "@/lib/student-finance";
import { recordFinancialAudit } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { error } = await requireStudentFinanceView();
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const filter: Record<string, unknown> = {};
    if (searchParams.get("type")) filter.type = searchParams.get("type");
    if (searchParams.get("academicLevel")) filter.academicLevel = searchParams.get("academicLevel");
    if (searchParams.get("season")) filter.season = searchParams.get("season");
    if (searchParams.get("isActive")) filter.isActive = searchParams.get("isActive") === "true";
    await connectDB();
    const [fees, total] = await Promise.all([
      StudentFeeConfig.find(filter).sort({ effectiveDate: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      StudentFeeConfig.countDocuments(filter),
    ]);
    return successResponse({ fees: fees.map(formatStudentFeeConfig), pagination: buildPaginationMeta(total, pagination) });
  } catch (err) {
    console.error("Student fees GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireStudentFinanceManage();
    if (error) return error;
    const body = await request.json();
    const amountMinor = amountToMinor(body.amount);
    if (!body.name?.trim()) return errorResponse("اسم الرسم مطلوب");
    if (!amountMinor || amountMinor <= 0) return errorResponse("مبلغ الرسم غير صالح");
    await connectDB();
    const fee = await StudentFeeConfig.create({
      name: body.name.trim(),
      type: body.type,
      amountMinor,
      academicLevel: body.academicLevel?.trim() || undefined,
      courseId: body.courseId || undefined,
      season: body.season?.trim() || undefined,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date(),
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
      isActive: body.isActive !== false,
      createdBy: user!._id,
      updatedBy: user!._id,
    });
    await recordFinancialAudit({
      userId: user!._id,
      action: "student_fee_config.create",
      recordType: "student_fee_config",
      recordId: fee._id.toString(),
      metadata: { newValues: formatStudentFeeConfig(fee) },
    });
    return successResponse({ fee: formatStudentFeeConfig(fee) }, 201);
  } catch (err) {
    console.error("Student fee POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
