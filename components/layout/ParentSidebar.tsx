"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Baby, BarChart3, Bell, Bot, Bus, CalendarCheck, FileText, GraduationCap, LayoutDashboard, LogOut, ReceiptText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACADEMY } from "@/lib/constants";

const parentLinks = [
  { href: "/parent/dashboard", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/parent/children", label: "أبنائي", icon: Users },
  { href: "/parent/attendance", label: "الحضور", icon: CalendarCheck },
  { href: "/parent/performance", label: "الأداء الدراسي", icon: BarChart3 },
  { href: "/parent/finance", label: "المالية", icon: ReceiptText },
  { href: "/parent/private-lessons", label: "الحصص الخاصة", icon: GraduationCap },
  { href: "/parent/kindergarten", label: "الروضة", icon: Baby },
  { href: "/parent/transportation", label: "النقل", icon: Bus },
  { href: "/parent/documents", label: "الوثائق", icon: FileText },
  { href: "/parent/communications", label: "التواصل", icon: Bell },
  { href: "/parent/reports", label: "التقارير", icon: BarChart3 },
  { href: "/parent/ai", label: "المساعد الذكي", icon: Bot },
];

export default function ParentSidebar() {
  const pathname = usePathname();
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-white md:min-h-screen md:w-64 md:border-b-0 md:border-l">
      <div className="border-b border-border p-5">
        <Link href="/" className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white"><Users className="h-4 w-4" /></div><div><p className="text-xs font-bold text-primary">{ACADEMY.name}</p><p className="text-[10px] text-muted">بوابة الأولياء</p></div></Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="قائمة ولي الأمر">
        {parentLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", pathname === href || pathname.startsWith(`${href}/`) ? "bg-pink-50 text-primary" : "text-foreground hover:bg-gray-50 hover:text-primary")}><Icon className="h-4 w-4" />{label}</Link>)}
      </nav>
      <div className="border-t border-border p-3"><button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"><LogOut className="h-4 w-4" />تسجيل الخروج</button></div>
    </aside>
  );
}
