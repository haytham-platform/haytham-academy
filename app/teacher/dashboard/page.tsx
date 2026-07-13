import type { Metadata } from "next";
import TeacherDashboardClient from "@/components/teacher-dashboard/TeacherDashboardClient";

export const metadata: Metadata = { title: "لوحة الأستاذ" };
export const dynamic = "force-dynamic";

export default function TeacherDashboardPage() {
  return <TeacherDashboardClient mode="dashboard" />;
}
