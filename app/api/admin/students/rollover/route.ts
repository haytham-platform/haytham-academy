import { requirePermission } from "@/lib/auth-helpers";
import { successResponse } from "@/lib/api-response";
import { handleRouteError } from "@/lib/api-errors";
import { connectDB } from "@/lib/db";
import { executeStudentRollover } from "@/lib/students";

export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission("students.rollover");
    if (error) return error;
    const body = await request.json();
    await connectDB();
    const result = await executeStudentRollover(body, user!._id);
    return successResponse(result, 201);
  } catch (error) {
    return handleRouteError("Student rollover POST", error);
  }
}
