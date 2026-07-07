import type { UserRole } from "@/types";

export type Permission =
  | "admin.access"
  | "settings.manage"
  | "courses.manage"
  | "teachers.manage"
  | "students.view"
  | "students.manage"
  | "enrollments.view"
  | "enrollments.manage"
  | "messages.view"
  | "messages.manage"
  | "news.manage"
  | "finance.manage"
  | "reports.view"
  | "transport.view"
  | "transport.manage"
  | "transport.record";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "admin.access",
    "settings.manage",
    "courses.manage",
    "teachers.manage",
    "students.view",
    "students.manage",
    "enrollments.view",
    "enrollments.manage",
    "messages.view",
    "messages.manage",
    "news.manage",
    "finance.manage",
    "reports.view",
    "transport.view",
    "transport.manage",
    "transport.record",
  ],
  deputy: [
    "admin.access",
    "courses.manage",
    "teachers.manage",
    "students.view",
    "students.manage",
    "enrollments.view",
    "enrollments.manage",
    "messages.view",
    "messages.manage",
    "news.manage",
    "reports.view",
    "transport.view",
    "transport.manage",
    "transport.record",
  ],
  secretary: [
    "admin.access",
    "students.view",
    "enrollments.view",
    "enrollments.manage",
    "messages.view",
    "reports.view",
    "transport.view",
    "transport.record",
  ],
  teacher: [],
  student: [],
};

export const STAFF_ROLES: UserRole[] = ["admin", "deputy", "secretary"];

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function canDeleteTransport(role: UserRole): boolean {
  return role === "admin";
}

export function canAccessAdminPath(role: UserRole, pathname: string): boolean {
  if (!hasPermission(role, "admin.access")) return false;

  if (pathname.startsWith("/admin/settings")) {
    return hasPermission(role, "settings.manage");
  }
  if (pathname.startsWith("/admin/news")) {
    return hasPermission(role, "news.manage");
  }
  if (pathname.startsWith("/admin/courses")) {
    return hasPermission(role, "courses.manage");
  }
  if (pathname.startsWith("/admin/teachers")) {
    return hasPermission(role, "teachers.manage");
  }
  if (pathname.startsWith("/admin/students")) {
    return hasPermission(role, "students.view");
  }
  if (pathname.startsWith("/admin/enrollments")) {
    return hasPermission(role, "enrollments.view");
  }
  if (pathname.startsWith("/admin/reports")) {
    return hasPermission(role, "reports.view");
  }
  if (pathname.startsWith("/admin/transport")) {
    return hasAnyPermission(role, ["transport.view", "transport.manage", "transport.record"]);
  }
  if (pathname.startsWith("/admin/messages")) {
    return hasPermission(role, "messages.view");
  }
  if (pathname.startsWith("/admin/finance")) {
    return hasPermission(role, "finance.manage");
  }

  return pathname.startsWith("/admin/dashboard");
}

export function getDashboardPath(role: UserRole): string {
  if (isStaffRole(role)) return "/admin/dashboard";
  if (role === "student") return "/student/dashboard";
  return "/";
}
