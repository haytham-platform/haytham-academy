import StudentSidebar from "@/components/layout/StudentSidebar";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") redirect("/login");

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <StudentSidebar />
      <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
