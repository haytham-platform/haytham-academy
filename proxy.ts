import { NextResponse, type NextRequest } from "next/server";
import { JWT_COOKIE_NAME } from "@/lib/constants";
import { canAccessAdminPath, isStaffRole } from "@/lib/permissions";
import type { UserRole } from "@/types";

function unauthorizedApi() {
  return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
}

async function validateSessionFromRequest(
  request: NextRequest
): Promise<{ userId: string; role: UserRole } | null> {
  const cookie = request.headers.get("cookie");
  if (!cookie?.includes(JWT_COOKIE_NAME)) return null;

  const validateUrl = new URL("/api/auth/validate-session", request.url);
  try {
    const res = await fetch(validateUrl, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { userId: string; role: UserRole };
    if (!data.userId || !data.role) return null;
    return data;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(JWT_COOKIE_NAME)?.value;

  const isAdminPage = pathname.startsWith("/admin");
  const isStudentPage = pathname.startsWith("/student");
  const isTeacherPage = pathname.startsWith("/teacher");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isTeacherApi = pathname.startsWith("/api/teacher");
  const isStudentApi =
    pathname.startsWith("/api/enrollments") &&
    !pathname.startsWith("/api/enrollments/public");

  const isProtected =
    isAdminPage ||
    isStudentPage ||
    isTeacherPage ||
    isAdminApi ||
    isStudentApi ||
    isTeacherApi;

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!token) {
    if (isAdminApi || isStudentApi || isTeacherApi) return unauthorizedApi();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await validateSessionFromRequest(request);

  if (!session) {
    if (isAdminApi || isStudentApi || isTeacherApi) return unauthorizedApi();
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set(JWT_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    return response;
  }

  const { role } = session;

  if (isAdminPage || isAdminApi) {
    if (!isStaffRole(role)) {
      if (isAdminApi) {
        return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isAdminPage && !canAccessAdminPath(role, pathname)) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  if ((isStudentPage || isStudentApi) && role !== "student") {
    if (isStudentApi) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if ((isTeacherPage || isTeacherApi) && role !== "teacher") {
    if (isTeacherApi) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/student/:path*",
    "/teacher/:path*",
    "/api/admin/:path*",
    "/api/teacher/:path*",
    "/api/enrollments",
    "/api/enrollments/:path*",
  ],
};
