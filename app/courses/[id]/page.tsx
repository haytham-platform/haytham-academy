import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import Course from "@/models/Course";
import { getMockCourseById } from "@/lib/mock-data";
import CourseDetailClient from "@/components/courses/CourseDetailClient";
import type { MockCourse } from "@/types/ui";

export const dynamic = "force-dynamic";

async function getCourse(id: string): Promise<MockCourse | null> {
  try {
    await connectDB();
    const course = await Course.findById(id).populate("teacher", "name subject").lean();
    if (course) {
      const teacher = course.teacher as { _id?: { toString(): string }; name?: string; subject?: string } | null;
      return {
        _id: course._id.toString(),
        title: course.title,
        description: course.description,
        price: course.price,
        image: course.image,
        level: course.level,
        duration: course.duration,
        startDate: course.startDate.toISOString(),
        seats: course.seats,
        teacher: {
          _id: teacher?._id?.toString() || "",
          name: teacher?.name || "غير محدد",
          subject: teacher?.subject || "",
        },
      };
    }
  } catch {
    /* fallback */
  }
  return getMockCourseById(id) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const course = await getCourse(id);
  return { title: course?.title || "تفاصيل الدورة" };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) notFound();

  return <CourseDetailClient course={course} />;
}
