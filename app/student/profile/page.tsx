import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StudentProfileForm from "@/components/student/StudentProfileForm";

export const metadata: Metadata = {
  title: "الملف الشخصي",
};

export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") redirect("/login");

  return (
    <div>
      <Title title="الملف الشخصي" subtitle="إدارة معلومات حسابك" className="mb-8" />

      <div className="mx-auto max-w-xl">
        <Card>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white">
              {user.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-lg font-bold">{user.name}</h2>
              <Badge className="mt-1">طالب</Badge>
            </div>
          </div>

          <StudentProfileForm name={user.name} phone={user.phone} />
        </Card>
      </div>
    </div>
  );
}
