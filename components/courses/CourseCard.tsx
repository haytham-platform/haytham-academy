"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, BarChart3, User, BookOpen, ArrowLeft } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

interface CourseCardProps {
  course: {
    _id: string;
    title: string;
    description: string;
    price: number;
    image: string;
    level: string;
    duration: string;
    teacher?: { name?: string; subject?: string } | null;
  };
  showEnroll?: boolean;
}

export default function CourseCard({ course, showEnroll = true }: CourseCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleEnroll(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
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

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }

      setMessage(data.message);
    } catch {
      setError("حدث خطأ أثناء التسجيل");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card hover padding="none" className="group flex flex-col overflow-hidden">
      <Link href={`/courses/${course._id}`} className="block">
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-100 to-sky-50">
          {course.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.image}
              alt={course.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-16 w-16 text-accent/40" aria-hidden="true" />
            </div>
          )}
          <div className="absolute start-3 top-3">
            <Badge variant="primary">{course.level}</Badge>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <Link href={`/courses/${course._id}`}>
          <h3 className="text-lg font-bold text-foreground transition group-hover:text-primary">
            {course.title}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
          {course.description}
        </p>

        <div className="mt-4 space-y-2 text-sm text-muted">
          <p className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" aria-hidden="true" />
            {course.teacher?.name || "غير محدد"}
          </p>
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            {course.duration}
          </p>
          <p className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
            {course.level}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xl font-bold text-primary">{formatPrice(course.price)}</p>
          <Link
            href={`/courses/${course._id}`}
            className="flex items-center gap-1 text-sm font-medium text-secondary hover:underline"
          >
            التفاصيل
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        {showEnroll && (
          <div className="mt-4">
            {message && (
              <p className="mb-2 rounded-xl bg-green-50 p-2.5 text-xs text-green-700" role="status">
                {message}
              </p>
            )}
            {error && (
              <p className="mb-2 rounded-xl bg-red-50 p-2.5 text-xs text-red-700" role="alert">
                {error}
              </p>
            )}
            <Button
              fullWidth
              loading={loading}
              onClick={handleEnroll}
              size="sm"
            >
              التسجيل في الدورة
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
