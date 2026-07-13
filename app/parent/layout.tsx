import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import ParentSidebar from "@/components/layout/ParentSidebar";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "parent") redirect("/login");

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground md:flex">
      <ParentSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
