import { successResponse } from "@/lib/api-response";
import { aiProviderStatus } from "@/lib/ai-platform";

export async function GET() {
  return successResponse(aiProviderStatus());
}
