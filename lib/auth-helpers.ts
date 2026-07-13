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
  return requirePermission("finance.view");
}

export async function requireFinancePayment() {
  return requirePermission("finance.payments");
}

export async function requireFinanceExpense() {
  return requirePermission("finance.expenses");
}

export async function requireFinancePayout() {
  return requirePermission("finance.payouts");
}

export async function requireFinanceCash() {
  return requirePermission("finance.cash");
}

export async function requireFinanceReports() {
  return requirePermission("finance.reports");
}

export async function requireFinanceManager() {
  return requirePermission("finance.manage");
}

export async function requireFinanceOwner() {
  return requirePermission("finance.owner");
}

export async function requireStudentFinanceView() {
  return requirePermission("student_finance.view");
}

export async function requireStudentFinanceManage() {
  return requirePermission("student_finance.manage");
}

export async function requireStudentFinancePayment() {
  return requirePermission("student_finance.payments");
}

export async function requireStudentFinanceDiscount() {
  return requirePermission("student_finance.discounts");
}

export async function requireStudentFinanceRefund() {
  return requirePermission("student_finance.refunds");
}

export async function requireStudentFinanceReports() {
  return requirePermission("student_finance.reports");
}

export async function requirePrivateLessonsView() {
  return requirePermission("private_lessons.view");
}

export async function requirePrivateLessonsManage() {
  return requirePermission("private_lessons.manage");
}

export async function requirePrivateLessonsAttendance() {
  return requirePermission("private_lessons.attendance");
}

export async function requirePrivateLessonsPricing() {
  return requirePermission("private_lessons.pricing");
}

export async function requirePrivateLessonsCompensation() {
  return requirePermission("private_lessons.compensation");
}

export async function requirePrivateLessonsFinance() {
  return requirePermission("private_lessons.finance");
}

export async function requirePrivateLessonsReports() {
  return requirePermission("private_lessons.reports");
}

export async function requireKindergartenView() {
  return requirePermission("kindergarten.view");
}

export async function requireKindergartenManage() {
  return requirePermission("kindergarten.manage");
}

export async function requireKindergartenPayment() {
  return requirePermission("kindergarten.payments");
}

export async function requireKindergartenCorrection() {
  return requirePermission("kindergarten.correct_payments");
}

export async function requireFinanceDelete() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  if (user!.role !== "admin" && user!.role !== "deputy") {
    return { user: null, error: errorResponse("الحذف المالي متاح للمدير والنائب فقط", 403) };
  }
  return { user, error: null };
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
  return hasPermission(actorRole, "students.manage") || hasPermission(actorRole, "students.update");
}
