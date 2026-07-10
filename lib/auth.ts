import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import {
  JWT_COOKIE_NAME,
  JWT_EXPIRES_IN,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/constants";
import { validateSession } from "@/lib/session";
import type { JwtPayload, UserRole, SafeUser } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET;

function getJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("Please define JWT_SECRET in your .env file");
  }
  return JWT_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    if (!payload.userId || !payload.sessionId) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getTokenCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function toSafeUser(user: {
  _id: { toString(): string };
  name: string;
  email?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}): SafeUser {
  return {
    _id: user._id.toString(),
    name: user.name,
    ...(user.email && { email: user.email }),
    ...(user.phone && { phone: user.phone }),
    role: user.role as UserRole,
    isActive: user.isActive,
    ...(user.createdAt && { createdAt: user.createdAt }),
    ...(user.updatedAt && { updatedAt: user.updatedAt }),
  };
}

export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(JWT_COOKIE_NAME)?.value ?? null;
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const token = await getTokenFromCookies();
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const validated = await validateSession(payload.sessionId, payload.userId);
  if (!validated) return null;

  return toSafeUser(validated.user);
}

export function requireRole(
  userRole: UserRole | undefined,
  allowedRoles: UserRole[]
): boolean {
  return !!userRole && allowedRoles.includes(userRole);
}

export function clearAuthCookie(response: {
  cookies: { set: (name: string, value: string, options: object) => void };
}) {
  response.cookies.set(JWT_COOKIE_NAME, "", {
    ...getTokenCookieOptions(0),
    maxAge: 0,
  });
}
