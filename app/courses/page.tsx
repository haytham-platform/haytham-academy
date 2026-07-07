import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Title from "@/components/ui/Title";
import CoursesGrid from "@/components/courses/CoursesGrid";
import { getCoursesForUI } from "@/lib/data-ui";

export const metadata: Metadata = {
  title: "الدورات",
};

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await getCoursesForUI();

  return (
    <div className="bg-background py-10 md:py-14">
      <Container>
        <Breadcrumb items={[{ label: "الدورات" }]} />
        <Title
          badge="الدورات التعليمية"
          title="استكشف دوراتنا"
          subtitle="برامج تعليمية متنوعة تناسب جميع المستويات والأهداف"
          className="mb-10"
        />
        <CoursesGrid courses={courses} />
      </Container>
    </div>
  );
}
