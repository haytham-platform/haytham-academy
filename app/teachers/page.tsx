import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Title from "@/components/ui/Title";
import TeacherCard from "@/components/teachers/TeacherCard";
import { getTeachersForUI } from "@/lib/data-ui";

export const metadata: Metadata = {
  title: "الأساتذة",
};

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const teachers = await getTeachersForUI();

  return (
    <div className="bg-background py-10 md:py-14">
      <Container>
        <Breadcrumb items={[{ label: "الأساتذة" }]} />
        <Title
          badge="فريقنا التعليمي"
          title="أساتذتنا المتميزون"
          subtitle="نخبة من الأساتذة ذوي الخبرة في مختلف التخصصات"
          className="mb-10"
        />
        {teachers.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {teachers.map((teacher) => (
              <TeacherCard key={teacher._id} teacher={teacher} />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted">لا يوجد أساتذة متاحون حالياً</p>
        )}
      </Container>
    </div>
  );
}
