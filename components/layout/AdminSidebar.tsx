"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  MessageSquare,
  ClipboardList,
  Newspaper,
  Settings,
  LogOut,
  Wallet,
  FileBarChart,
  Bus,
  Archive,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, type Permission } from "@/lib/permissions";
import AcademyLogo from "@/components/ui/AcademyLogo";
import type { UserRole } from "@/types";

const adminLinks: {
  href: string;
  label: string;
  icon: React.ElementType;
  permission: Permission;
}[] = [
  { href: "/admin/dashboard", label: "نظرة عامة", icon: LayoutDashboard, permission: "admin.access" },
  { href: "/admin/students", label: "الطلاب", icon: Users, permission: "students.view" },
  { href: "/admin/courses", label: "الدورات", icon: BookOpen, permission: "courses.manage" },
  { href: "/admin/teachers", label: "الأساتذة", icon: GraduationCap, permission: "teachers.manage" },
  { href: "/admin/messages", label: "الرسائل", icon: MessageSquare, permission: "messages.view" },
  { href: "/admin/enrollments", label: "التسجيلات", icon: ClipboardList, permission: "enrollments.view" },
  { href: "/admin/transport", label: "النقل", icon: Bus, permission: "transport.view" },
  { href: "/admin/reports", label: "التقارير", icon: FileBarChart, permission: "reports.view" },
  { href: "/admin/academic-seasons", label: "المواسم الدراسية", icon: CalendarRange, permission: "academic_seasons.view" },
  { href: "/admin/archive", label: "الأرشيف", icon: Archive, permission: "archive.view" },
  { href: "/admin/finance", label: "الحسابات والمالية", icon: Wallet, permission: "finance.view" },
  { href: "/admin/news", label: "الأخبار", icon: Newspaper, permission: "news.manage" },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings, permission: "settings.manage" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setRole(d.user?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  const visibleLinks = adminLinks.filter(
    (link) => role && hasPermission(role, link.permission)
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-primary text-white md:min-h-screen md:w-64 md:border-b-0 md:border-l">
      <div className="border-b border-white/10 p-5">
        <AcademyLogo size="sm" variant="dark" showText />
        <p className="mt-2 text-[10px] text-pink-200">لوحة الإدارة</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="قائمة الإدارة">
        {visibleLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-secondary text-white"
                : "text-pink-100 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
