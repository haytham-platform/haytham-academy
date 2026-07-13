import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import TeacherSidebar from "@/components/layout/TeacherSidebar";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") redirect("/login");

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground md:flex">
      <TeacherSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
