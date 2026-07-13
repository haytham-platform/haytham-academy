import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Phone, BookOpen, GraduationCap } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CourseCard from "@/components/courses/CourseCard";
import { connectDB } from "@/lib/db";
import Teacher from "@/models/Teacher";
import Course from "@/models/Course";

export const dynamic = "force-dynamic";

async function getTeacherData(id: string) {
  await connectDB();
  const teacher = await Teacher.findOne({
    _id: id,
    isActive: true,
    deletedAt: null,
    $or: [{ status: "active" }, { status: { $exists: false } }],
  }).lean();
  if (!teacher) return null;

  const courses = await Course.find({ teacher: id, isActive: true, deletedAt: null })
    .populate("teacher", "name subject")
    .lean();

  const subjects = teacher.subjects?.length ? teacher.subjects : [teacher.subject];
  const academicLevels = teacher.academicLevels?.length
    ? teacher.academicLevels
    : [teacher.teachingLevel];

  return {
    teacher: {
      _id: teacher._id.toString(),
      name: teacher.name,
      subject: teacher.subject,
      phone: teacher.phone,
      teachingLevel: teacher.teachingLevel,
      subjects,
      academicLevels,
    },
    courses: courses.map((c) => ({
      _id: c._id.toString(),
      title: c.title,
      description: c.description,
      price: c.price,
      image: c.image,
      level: c.level,
      duration: c.duration,
      startDate: c.startDate.toISOString(),
      seats: c.seats,
      teacher: {
        _id: teacher._id.toString(),
        name: teacher.name,
        subject: teacher.subject,
      },
    })),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getTeacherData(id);
  return { title: data?.teacher.name || "تفاصيل الأستاذ" };
}

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getTeacherData(id);
  if (!data) notFound();

  const { teacher, courses } = data;

  return (
    <div className="bg-background py-10 md:py-14">
      <Container>
        <Breadcrumb
          items={[
            { label: "الأساتذة", href: "/teachers" },
            { label: teacher.name },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-3">
          <Card className="text-center lg:col-span-1">
            <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-sky-50 text-4xl font-bold text-primary">
              {teacher.name.charAt(0)}
            </div>
            <h1 className="mt-4 text-2xl font-bold">{teacher.name}</h1>
            <Badge className="mt-2">{teacher.subject}</Badge>

            <div className="mt-6 space-y-3 border-t border-border pt-6 text-sm">
              <p className="flex items-center justify-center gap-2 text-muted">
                <GraduationCap className="h-4 w-4 text-primary" />
                {teacher.academicLevels.join("، ")}
              </p>
              <p className="flex items-center justify-center gap-2 text-muted">
                <Phone className="h-4 w-4 text-primary" />
                <a href={`tel:${teacher.phone}`} className="hover:text-primary">{teacher.phone}</a>
              </p>
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {teacher.subjects.map((subject) => (
                <Badge key={subject} variant="muted">{subject}</Badge>
              ))}
            </div>
          </Card>

          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-xl font-bold">المستويات الدراسية</h2>
              <p className="mt-4 leading-8 text-muted">{teacher.academicLevels.join("، ")}</p>
            </Card>

            <div className="mt-8">
              <h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
                <BookOpen className="h-5 w-5 text-primary" />
                دورات الأستاذ
              </h2>
              {courses.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {courses.map((course) => (
                    <CourseCard key={course._id} course={course} showEnroll={false} />
                  ))}
                </div>
              ) : (
                <p className="text-muted">لا توجد دورات حاليا</p>
              )}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
