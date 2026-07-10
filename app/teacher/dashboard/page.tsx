import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { User } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "لوحة الأستاذ",
};

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") redirect("/login");

  return (
    <div>
      <Title
        title={`مرحبا، ${user.name}`}
        subtitle="إليك نظرة عامة على حسابك"
        className="mb-8"
      />

      <Card className="max-w-xl">
        <User className="mb-3 h-6 w-6 text-primary" />
        <h2 className="mb-4 font-bold">معلومات الحساب</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted">الاسم</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          {user.phone ? (
            <div>
              <dt className="text-muted">رقم الهاتف</dt>
              <dd className="font-medium">{user.phone}</dd>
            </div>
          ) : null}
          {user.email ? (
            <div>
              <dt className="text-muted">البريد الإلكتروني</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-muted">الدور</dt>
            <dd>
              <Badge>أستاذ</Badge>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
