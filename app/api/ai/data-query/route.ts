import { errorResponse, successResponse } from "@/lib/api-response";
import { AIPlatformError, runNaturalDataQuery } from "@/lib/ai-platform";

export async function POST(req: Request) {
  try {
    return successResponse(await runNaturalDataQuery(await req.json()));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تنفيذ الاستعلام الذكي", error instanceof AIPlatformError ? error.status : 500);
  }
}
