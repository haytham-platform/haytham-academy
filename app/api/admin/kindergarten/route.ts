import KindergartenRegistration from "@/models/Kindergarten";
import { requireKindergartenManage, requireKindergartenView } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { createKindergartenRegistration, formatKindergartenRegistration, listKindergartenRegistrations } from "@/lib/kindergarten";
import { arabicError } from "@/lib/arabic-errors";

export async function GET(request: Request) {
  try {
    const { error } = await requireKindergartenView();
    if (error) return error;
    const { searchParams } = new URL(request.url);
    return successResponse(await listKindergartenRegistrations(searchParams));
  } catch (err) {
    console.error("Kindergarten GET:", err);
    return errorResponse(arabicError(err), 400);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireKindergartenManage();
    if (error) return error;
    const registration = await createKindergartenRegistration(await request.json(), user!._id);
    return successResponse({ registration }, 201);
  } catch (err) {
    console.error("Kindergarten POST:", err);
    return errorResponse(arabicError(err), 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const { error } = await requireKindergartenView();
    if (error) return error;
    const body = await request.json();
    await connectDB();
    const rows = await KindergartenRegistration.find(body?.filter || { deletedAt: null }).populate("teacherId", "name").limit(100).lean();
    return successResponse({ registrations: rows.map(formatKindergartenRegistration) });
  } catch (err) {
    console.error("Kindergarten PATCH:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
