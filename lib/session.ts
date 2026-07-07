import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import Session from "@/models/Session";
import User from "@/models/User";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/constants";
import type { UserRole } from "@/types";

export function getClientMeta(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress =
    forwarded?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent") ?? "";
  return { userAgent, ipAddress };
}

export async function createSession(
  userId: string,
  userAgent: string,
  ipAddress: string
) {
  await connectDB();

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await Session.create({
    userId,
    sessionId,
    userAgent,
    ipAddress,
    isActive: true,
    expiresAt,
  });

  return { sessionId, maxAgeSeconds: SESSION_MAX_AGE_SECONDS };
}

export async function validateSession(sessionId: string, userId: string) {
  await connectDB();

  const session = await Session.findOne({ sessionId, userId }).lean();
  if (!session) return null;
  if (!session.isActive) return null;
  if (session.expiresAt < new Date()) return null;

  const user = await User.findById(userId).select("-password").lean();
  if (!user || !user.isActive) return null;

  return {
    user,
    session,
    role: user.role as UserRole,
  };
}

export async function revokeSession(sessionId: string) {
  await connectDB();
  await Session.updateOne(
    { sessionId },
    { isActive: false, revokedAt: new Date() }
  );
}

export async function revokeAllUserSessions(userId: string) {
  await connectDB();
  await Session.updateMany(
    { userId, isActive: true },
    { isActive: false, revokedAt: new Date() }
  );
}
