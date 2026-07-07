import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStudentEnrollments } from "@/lib/data";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import type { EnrollmentStatus } from "@/types";

export const metadata: Metadata = {
  title: "دوراتي",
};

export const dynamic = "force-dynamic";

export default async function StudentCoursesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") redirect("/login");

  let enrollments: Awaited<ReturnType<typeof getStudentEnrollments>> = [];
  try {
    enrollments = await getStudentEnrollments(user._id);
  } catch {
    /* empty */
  }

  return (
    <div>
      <Title title="دوراتي" subtitle="جميع الدورات التي سجلت فيها" className="mb-8" />

      {enrollments.length > 0 ? (
        <div className="space-y-4">
          {enrollments.map((enrollment) => (
            <Card key={enrollment._id} hover>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    {enrollment.course?.title || "دورة محذوفة"}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {enrollment.course?.level} • {enrollment.course?.duration}
                  </p>
                  {enrollment.course?.price && (
                    <p className="mt-1 text-sm font-medium text-primary">
                      {enrollment.course.price.toLocaleString("ar-DZ")} د.ج
                    </p>
                  )}
                </div>
                <StatusBadge status={enrollment.status as EnrollmentStatus} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="لا توجد دورات"
          description="لم تسجل في أي دورة بعد. تصفح دوراتنا واختر ما يناسبك."
          actionLabel="تصفح الدورات"
          actionHref="/courses"
        />
      )}
    </div>
  );
}
