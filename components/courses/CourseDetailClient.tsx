"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  BarChart3,
  Users,
  Calendar,
  User,
  BookOpen,
} from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatPrice, formatDate } from "@/lib/utils";
import type { CourseDetailData } from "@/types/ui";

interface CourseDetailClientProps {
  course: CourseDetailData;
}

export default function CourseDetailClient({ course }: CourseDetailClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleEnroll() {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course._id }),
      });
      const data = await res.json();
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) { setError(data.error || "حدث خطأ"); return; }
      setMessage(data.message);
    } catch {
      setError("حدث خطأ أثناء التسجيل");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-background py-10 md:py-14">
      <Container>
        <Breadcrumb
          items={[
            { label: "الدورات", href: "/courses" },
            { label: course.title },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-sky-50">
              {course.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.image} alt={course.title} className="h-72 w-full object-cover md:h-96" />
              ) : (
                <div className="flex h-72 items-center justify-center md:h-96">
                  <BookOpen className="h-24 w-24 text-accent/40" />
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap gap-2">
                <Badge>{course.level}</Badge>
                <Badge variant="muted">{course.duration}</Badge>
              </div>
              <h1 className="mt-4 text-2xl font-bold md:text-3xl">{course.title}</h1>
              <p className="mt-4 leading-8 text-muted">{course.description}</p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-24 !shadow-soft-lg">
              <p className="text-3xl font-bold text-primary">{formatPrice(course.price)}</p>
              <p className="mt-1 text-sm text-muted">سعر الدورة الكامل</p>

              <ul className="mt-6 space-y-4 border-t border-border pt-6">
                <li className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-muted">الأستاذ:</span>
                  <span className="font-medium">{course.teacher.name}</span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-muted">المستوى:</span>
                  <span className="font-medium">{course.level}</span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-muted">المدة:</span>
                  <span className="font-medium">{course.duration}</span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-muted">تاريخ البداية:</span>
                  <span className="font-medium">{formatDate(course.startDate)}</span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-muted">المقاعد:</span>
                  <span className="font-medium">{course.seats} مقعد</span>
                </li>
              </ul>

              {message && (
                <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700" role="status">{message}</p>
              )}
              {error && (
                <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>
              )}

              <Button fullWidth loading={loading} onClick={handleEnroll} className="mt-6" size="lg">
                التسجيل في الدورة
              </Button>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
