import { getCurrentUser } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/permissions";
import { errorResponse } from "@/lib/api-response";
import type { UserRole } from "@/types";

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, error: errorResponse("غير مصرح", 401) };
  }
  return { user, error: null };
}

export async function requirePermission(permission: Permission) {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };

  if (!hasPermission(user!.role, permission)) {
    return { user: null, error: errorResponse("ليس لديك صلاحية لهذا الإجراء", 403) };
  }

  return { user, error: null };
}

export async function requireAdmin() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };

  if (user!.role !== "admin") {
    return { user: null, error: errorResponse("ليس لديك صلاحية لهذا الإجراء", 403) };
  }

  return { user, error: null };
}

export async function requireFinance() {
  return requirePermission("finance.manage");
}

export async function requireTransportView() {
  return requirePermission("transport.view");
}

export async function requireTransportManage() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  if (!hasPermission(user!.role, "transport.manage")) {
    return { user: null, error: errorResponse("ليس لديك صلاحية لهذا الإجراء", 403) };
  }
  return { user, error: null };
}

export async function requireTransportAccess() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  const ok =
    hasPermission(user!.role, "transport.view") ||
    hasPermission(user!.role, "transport.manage") ||
    hasPermission(user!.role, "transport.record");
  if (!ok) {
    return { user: null, error: errorResponse("ليس لديك صلاحية لهذا الإجراء", 403) };
  }
  return { user, error: null };
}

export async function requireTransportWrite() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  const ok =
    hasPermission(user!.role, "transport.manage") ||
    hasPermission(user!.role, "transport.record");
  if (!ok) {
    return { user: null, error: errorResponse("ليس لديك صلاحية لهذا الإجراء", 403) };
  }
  return { user, error: null };
}

export async function requireTransportDelete() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  if (user!.role !== "admin") {
    return { user: null, error: errorResponse("الحذف متاح للمدير فقط", 403) };
  }
  return { user, error: null };
}

export function canModifyTargetUser(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  if (targetRole === "admin" && actorRole !== "admin") {
    return false;
  }
  return hasPermission(actorRole, "students.manage");
}
