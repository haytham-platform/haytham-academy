import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Bell, User } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getStudentEnrollments } from "@/lib/data";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StatusBadge from "@/components/ui/StatusBadge";
import Button from "@/components/ui/Button";
import StudentTransportWidget from "@/components/transport/StudentTransportWidget";
import { mockNotifications } from "@/lib/mock-data";
import type { EnrollmentStatus } from "@/types";

export const metadata: Metadata = {
  title: "لوحة الطالب",
};

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") redirect("/login");

  let enrollments: Awaited<ReturnType<typeof getStudentEnrollments>> = [];
  try {
    enrollments = await getStudentEnrollments(user._id);
  } catch {
    /* empty */
  }

  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  return (
    <div>
      <Title
        title={`مرحباً، ${user.name}`}
        subtitle="إليك نظرة عامة على حسابك ودوراتك"
        className="mb-8"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card hover>
          <BookOpen className="mb-2 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold">{enrollments.length}</p>
          <p className="text-sm text-muted">دورات مسجلة</p>
        </Card>
        <Card hover>
          <Bell className="mb-2 h-5 w-5 text-accent" />
          <p className="text-2xl font-bold">{unreadCount}</p>
          <p className="text-sm text-muted">إشعارات جديدة</p>
        </Card>
        <Card hover>
          <User className="mb-2 h-5 w-5 text-secondary" />
          <p className="text-2xl font-bold">نشط</p>
          <p className="text-sm text-muted">حالة الحساب</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-4 font-bold">معلومات الحساب</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted">الاسم</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-muted">رقم الهاتف</dt>
              <dd className="font-medium">{user.phone}</dd>
            </div>
            <div>
              <dt className="text-muted">الدور</dt>
              <dd><Badge>طالب</Badge></dd>
            </div>
          </dl>
          <Button href="/student/profile" variant="outline" size="sm" className="mt-4">
            تعديل الملف
          </Button>
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">دوراتي الأخيرة</h2>
            <Link href="/student/courses" className="text-sm font-medium text-secondary hover:underline">
              عرض الكل
            </Link>
          </div>
          {enrollments.length > 0 ? (
            <div className="space-y-3">
              {enrollments.slice(0, 5).map((enrollment) => (
                <div
                  key={enrollment._id}
                  className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-medium">{enrollment.course?.title || "دورة محذوفة"}</h3>
                    <p className="text-sm text-muted">
                      {enrollment.course?.level} • {enrollment.course?.duration}
                    </p>
                  </div>
                  <StatusBadge status={enrollment.status as EnrollmentStatus} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted">لم تسجل في أي دورة بعد</p>
              <Button href="/courses" className="mt-4" size="sm">تصفح الدورات</Button>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <StudentTransportWidget />
      </div>
    </div>
  );
}
