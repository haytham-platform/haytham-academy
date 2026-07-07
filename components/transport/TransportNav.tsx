"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/transport", label: "نظرة عامة", exact: true },
  { href: "/admin/transport/buses", label: "الحافلات" },
  { href: "/admin/transport/drivers", label: "السائقون" },
  { href: "/admin/transport/routes", label: "خطوط السير" },
  { href: "/admin/transport/subscriptions", label: "تسجيل الطلاب" },
  { href: "/admin/transport/passengers", label: "قائمة الركاب" },
];

export default function TransportNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-2">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              active ? "bg-primary text-white" : "text-muted hover:bg-muted/10"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
