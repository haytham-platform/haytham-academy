"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, BookOpenCheck, Bot, CalendarDays, FileText, GraduationCap, LayoutDashboard, LogOut, ReceiptText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACADEMY } from "@/lib/constants";

const teacherLinks = [
  { href: "/teacher/dashboard", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/teacher/profile", label: "ملفي", icon: GraduationCap },
  { href: "/teacher/schedule", label: "جدولي", icon: CalendarDays },
  { href: "/teacher/students", label: "طلابي", icon: Users },
  { href: "/teacher/attendance", label: "الحضور", icon: BookOpenCheck },
  { href: "/teacher/grades", label: "النقاط", icon: BarChart3 },
  { href: "/teacher/private-lessons", label: "الحصص الخاصة", icon: CalendarDays },
  { href: "/teacher/finance", label: "المالية", icon: ReceiptText },
  { href: "/teacher/communications", label: "التواصل", icon: Bell },
  { href: "/teacher/documents", label: "الوثائق", icon: FileText },
  { href: "/teacher/reports", label: "تقاريري", icon: BarChart3 },
  { href: "/teacher/ai", label: "المساعد الذكي", icon: Bot },
];

export default function TeacherSidebar() {
  const pathname = usePathname();
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-white md:min-h-screen md:w-64 md:border-b-0 md:border-l">
      <div className="border-b border-border p-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white"><GraduationCap className="h-4 w-4" /></div>
          <div><p className="text-xs font-bold text-primary">{ACADEMY.name}</p><p className="text-[10px] text-muted">لوحة الأستاذ</p></div>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="قائمة الأستاذ">
        {teacherLinks.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", pathname === href || pathname.startsWith(`${href}/`) ? "bg-pink-50 text-primary" : "text-foreground hover:bg-gray-50 hover:text-primary")}>
            <Icon className="h-4 w-4" />{label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border p-3"><button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"><LogOut className="h-4 w-4" />تسجيل الخروج</button></div>
    </aside>
  );
}
