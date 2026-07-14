import { errorResponse, successResponse } from "@/lib/api-response";
import { AIPlatformError, listAIConversations, sendAIMessage } from "@/lib/ai-platform";

export async function GET(req: Request) {
  try {
    const scope = new URL(req.url).searchParams.get("scope") || "student";
    if (!["admin", "teacher", "parent", "student"].includes(scope)) return errorResponse("نطاق مساعد غير صالح", 400);
    return successResponse(await listAIConversations(scope as "admin" | "teacher" | "parent" | "student"));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر تحميل محادثات الذكاء الاصطناعي", error instanceof AIPlatformError ? error.status : 500);
  }
}

export async function POST(req: Request) {
  try {
    return successResponse(await sendAIMessage(await req.json()));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "تعذر إرسال رسالة الذكاء الاصطناعي", error instanceof AIPlatformError ? error.status : 500);
  }
}
