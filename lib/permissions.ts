import type { UserRole } from "@/types";

export type Permission =
  | "admin.access"
  | "settings.manage"
  | "courses.manage"
  | "teachers.manage"
  | "students.view"
  | "students.manage"
  | "students.create"
  | "students.update"
  | "students.archive"
  | "students.restore"
  | "students.export"
  | "students.manage_guardians"
  | "students.manage_enrollments"
  | "students.manage_attendance"
  | "students.manage_payments"
  | "students.manage_documents"
  | "students.manage_grades"
  | "students.manage_behavior"
  | "students.manage_medical"
  | "students.manage_transportation"
  | "students.manage_notes"
  | "students.view_financial"
  | "students.view_sensitive"
  | "students.rollover"
  | "enrollments.view"
  | "enrollments.manage"
  | "messages.view"
  | "messages.manage"
  | "news.manage"
  | "finance.manage"
  | "finance.view"
  | "finance.payments"
  | "finance.expenses"
  | "finance.payouts"
  | "finance.cash"
  | "finance.reports"
  | "finance.owner"
  | "student_finance.view"
  | "student_finance.manage"
  | "student_finance.payments"
  | "student_finance.discounts"
  | "student_finance.refunds"
  | "student_finance.reports"
  | "private_lessons.view"
  | "private_lessons.manage"
  | "private_lessons.attendance"
  | "private_lessons.pricing"
  | "private_lessons.compensation"
  | "private_lessons.finance"
  | "private_lessons.reports"
  | "kindergarten.view"
  | "kindergarten.manage"
  | "kindergarten.payments"
  | "kindergarten.correct_payments"
  | "reports.view"
  | "reports.export"
  | "reports.print"
  | "reports.finance"
  | "reports.students"
  | "reports.teachers"
  | "reports.attendance"
  | "reports.private_lessons"
  | "reports.kindergarten"
  | "academic_seasons.view"
  | "academic_seasons.create"
  | "academic_seasons.update"
  | "academic_seasons.activate"
  | "academic_seasons.close"
  | "academic_seasons.reopen"
  | "academic_seasons.archive"
  | "academic_seasons.restore"
  | "academic_seasons.rollover"
  | "academic_seasons.rollover_preview"
  | "academic_seasons.rollover_execute"
  | "academic_seasons.rollover_override"
  | "academic_seasons.export"
  | "academic_seasons.print"
  | "archive.view"
  | "archive.restore"
  | "archive.export"
  | "communications.view"
  | "communications.create"
  | "communications.update"
  | "communications.send"
  | "communications.schedule"
  | "communications.cancel"
  | "communications.retry"
  | "communications.bulk_send"
  | "communications.export"
  | "communications.manage_templates"
  | "communications.manage_settings"
  | "communications.view_delivery_logs"
  | "communications.view_sensitive"
  | "communications.override_preferences"
  | "notifications.view"
  | "notifications.manage"
  | "notifications.send_system"
  | "teacher.dashboard.view"
  | "teacher.students.view"
  | "teacher.attendance.manage"
  | "teacher.grades.manage"
  | "teacher.private_lessons.view"
  | "teacher.finance.view"
  | "teacher.schedule.view"
  | "teacher.documents.view"
  | "teacher.reports.view"
  | "parent.dashboard.view"
  | "parent.students.view"
  | "parent.attendance.view"
  | "parent.finance.view"
  | "parent.documents.view"
  | "parent.reports.view"
  | "parent.communications.view"
  | "student.dashboard.view"
  | "student.profile.view"
  | "student.schedule.view"
  | "student.attendance.view"
  | "student.grades.view"
  | "student.finance.view"
  | "student.documents.view"
  | "student.reports.view"
  | "student.communications.view"
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
    "students.create",
    "students.update",
    "students.archive",
    "students.restore",
    "students.export",
    "students.manage_guardians",
    "students.manage_enrollments",
    "students.manage_attendance",
    "students.manage_payments",
    "students.manage_documents",
    "students.manage_grades",
    "students.manage_behavior",
    "students.manage_medical",
    "students.manage_transportation",
    "students.manage_notes",
    "students.view_financial",
    "students.view_sensitive",
    "students.rollover",
    "enrollments.view",
    "enrollments.manage",
    "messages.view",
    "messages.manage",
    "news.manage",
    "finance.manage",
    "finance.view",
    "finance.payments",
    "finance.expenses",
    "finance.payouts",
    "finance.cash",
    "finance.reports",
    "finance.owner",
    "student_finance.view",
    "student_finance.manage",
    "student_finance.payments",
    "student_finance.discounts",
    "student_finance.refunds",
    "student_finance.reports",
    "private_lessons.view",
    "private_lessons.manage",
    "private_lessons.attendance",
    "private_lessons.pricing",
    "private_lessons.compensation",
    "private_lessons.finance",
    "private_lessons.reports",
    "kindergarten.view",
    "kindergarten.manage",
    "kindergarten.payments",
    "kindergarten.correct_payments",
    "reports.view",
    "reports.export",
    "reports.print",
    "reports.finance",
    "reports.students",
    "reports.teachers",
    "reports.attendance",
    "reports.private_lessons",
    "reports.kindergarten",
    "academic_seasons.view",
    "academic_seasons.create",
    "academic_seasons.update",
    "academic_seasons.activate",
    "academic_seasons.close",
    "academic_seasons.reopen",
    "academic_seasons.archive",
    "academic_seasons.restore",
    "academic_seasons.rollover",
    "academic_seasons.rollover_preview",
    "academic_seasons.rollover_execute",
    "academic_seasons.rollover_override",
    "academic_seasons.export",
    "academic_seasons.print",
    "archive.view",
    "archive.restore",
    "archive.export",
    "communications.view",
    "communications.create",
    "communications.update",
    "communications.send",
    "communications.schedule",
    "communications.cancel",
    "communications.retry",
    "communications.bulk_send",
    "communications.export",
    "communications.manage_templates",
    "communications.manage_settings",
    "communications.view_delivery_logs",
    "communications.view_sensitive",
    "communications.override_preferences",
    "notifications.view",
    "notifications.manage",
    "notifications.send_system",
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
    "students.create",
    "students.update",
    "students.export",
    "students.manage_guardians",
    "students.manage_enrollments",
    "students.manage_attendance",
    "students.manage_payments",
    "students.manage_documents",
    "students.manage_transportation",
    "students.manage_notes",
    "students.view_financial",
    "enrollments.view",
    "enrollments.manage",
    "messages.view",
    "messages.manage",
    "news.manage",
    "finance.manage",
    "finance.view",
    "finance.payments",
    "finance.expenses",
    "finance.payouts",
    "finance.cash",
    "finance.reports",
    "student_finance.view",
    "student_finance.manage",
    "student_finance.payments",
    "student_finance.reports",
    "private_lessons.view",
    "private_lessons.manage",
    "private_lessons.attendance",
    "private_lessons.reports",
    "kindergarten.view",
    "kindergarten.manage",
    "kindergarten.payments",
    "reports.view",
    "reports.export",
    "reports.print",
    "reports.students",
    "reports.teachers",
    "reports.attendance",
    "reports.private_lessons",
    "reports.kindergarten",
    "academic_seasons.view",
    "academic_seasons.create",
    "academic_seasons.update",
    "academic_seasons.activate",
    "academic_seasons.close",
    "academic_seasons.reopen",
    "academic_seasons.archive",
    "academic_seasons.restore",
    "academic_seasons.rollover",
    "academic_seasons.rollover_preview",
    "academic_seasons.rollover_execute",
    "academic_seasons.rollover_override",
    "academic_seasons.export",
    "academic_seasons.print",
    "archive.view",
    "archive.restore",
    "archive.export",
    "communications.view",
    "communications.create",
    "communications.update",
    "communications.send",
    "communications.schedule",
    "communications.cancel",
    "communications.retry",
    "communications.bulk_send",
    "communications.export",
    "communications.manage_templates",
    "communications.view_delivery_logs",
    "notifications.view",
    "notifications.manage",
    "notifications.send_system",
    "transport.view",
    "transport.manage",
    "transport.record",
  ],
  secretary: [
    "admin.access",
    "students.view",
    "students.create",
    "students.update",
    "students.manage_guardians",
    "students.manage_enrollments",
    "students.manage_attendance",
    "students.manage_payments",
    "students.manage_documents",
    "students.manage_transportation",
    "students.manage_notes",
    "students.view_financial",
    "enrollments.view",
    "enrollments.manage",
    "messages.view",
    "finance.view",
    "finance.payments",
    "finance.expenses",
    "finance.cash",
    "student_finance.view",
    "student_finance.payments",
    "private_lessons.view",
    "private_lessons.manage",
    "private_lessons.attendance",
    "private_lessons.finance",
    "kindergarten.view",
    "kindergarten.manage",
    "kindergarten.payments",
    "reports.view",
    "reports.students",
    "reports.attendance",
    "reports.private_lessons",
    "reports.kindergarten",
    "academic_seasons.view",
    "academic_seasons.rollover_preview",
    "academic_seasons.export",
    "academic_seasons.print",
    "archive.view",
    "archive.export",
    "communications.view",
    "communications.create",
    "communications.send",
    "communications.schedule",
    "communications.cancel",
    "communications.export",
    "communications.view_delivery_logs",
    "notifications.view",
    "transport.view",
    "transport.record",
  ],
  teacher: [
    "teacher.dashboard.view",
    "teacher.students.view",
    "teacher.attendance.manage",
    "teacher.grades.manage",
    "teacher.private_lessons.view",
    "teacher.finance.view",
    "teacher.schedule.view",
    "teacher.documents.view",
    "teacher.reports.view",
    "notifications.view",
  ],
  parent: [
    "parent.dashboard.view",
    "parent.students.view",
    "parent.attendance.view",
    "parent.finance.view",
    "parent.documents.view",
    "parent.reports.view",
    "parent.communications.view",
    "notifications.view",
  ],
  student: [
    "student.dashboard.view",
    "student.profile.view",
    "student.schedule.view",
    "student.attendance.view",
    "student.grades.view",
    "student.finance.view",
    "student.documents.view",
    "student.reports.view",
    "student.communications.view",
    "notifications.view",
  ],
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
  if (pathname.startsWith("/admin/academic-seasons")) {
    return hasPermission(role, "academic_seasons.view");
  }
  if (pathname.startsWith("/admin/archive")) {
    return hasPermission(role, "archive.view");
  }
  if (pathname.startsWith("/admin/communications")) {
    return hasPermission(role, "communications.view");
  }
  if (pathname.startsWith("/admin/notifications")) {
    return hasPermission(role, "notifications.view");
  }
  if (pathname.startsWith("/admin/transport")) {
    return hasAnyPermission(role, ["transport.view", "transport.manage", "transport.record"]);
  }
  if (pathname.startsWith("/admin/messages")) {
    return hasPermission(role, "messages.view");
  }
  if (pathname.startsWith("/admin/finance")) {
    return hasPermission(role, "finance.view");
  }

  return pathname.startsWith("/admin/dashboard");
}

export function getDashboardPath(role: UserRole): string {
  if (isStaffRole(role)) return "/admin/dashboard";
  if (role === "student") return "/student/dashboard";
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "parent") return "/parent/dashboard";
  return "/";
}
