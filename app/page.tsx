import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import HeroSection from "@/components/home/HeroSection";
import { ServicesSection, StatsSection } from "@/components/home/ServicesSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import CtaSection from "@/components/home/CtaSection";
import MapSection from "@/components/home/MapSection";
import Section from "@/components/ui/Section";
import Title from "@/components/ui/Title";
import CourseCard from "@/components/courses/CourseCard";
import TeacherCard from "@/components/teachers/TeacherCard";
import NewsCard from "@/components/news/NewsCard";
import { getCoursesForUI, getTeachersForUI } from "@/lib/data-ui";
import { mockNews } from "@/lib/mock-data";
import { ACADEMY } from "@/lib/constants";

export const dynamic = "force-dynamic";

const whyUs = [
  { title: "أساتذة متميزون", description: "فريق تعليمي ذو خبرة في مختلف التخصصات", icon: "👨‍🏫" },
  { title: "دورات متنوعة", description: "برامج تعليمية تناسب جميع المستويات", icon: "📚" },
  { title: "متابعة مستمرة", description: "دعم أكاديمي ومتابعة لتقدم الطلاب", icon: "📈" },
  { title: "بيئة محفزة", description: "جو تعليمي يساعد على الإبداع والتفوق", icon: "🎯" },
];

export default async function HomePage() {
  const [courses, teachers] = await Promise.all([
    getCoursesForUI(3),
    getTeachersForUI(3),
  ]);

  return (
    <>
      <HeroSection />
      <ServicesSection />

      <Section background="default">
        <Title
          badge="لماذا نحن"
          title={`لماذا تختار ${ACADEMY.name}؟`}
          subtitle="نلتزم بتقديم تعليم عالي الجودة يلبي احتياجات الطلاب"
          align="center"
          className="mb-12"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyUs.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-white p-6 text-center shadow-soft transition hover:-translate-y-1 hover:shadow-soft-lg"
            >
              <div className="mb-4 text-4xl">{item.icon}</div>
              <h3 className="font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <StatsSection />

      <Section background="white">
        <div className="mb-10 flex items-end justify-between">
          <Title badge="الدورات" title="أحدث الدورات" subtitle="اكتشف برامجنا التعليمية المتنوعة" />
          <Link href="/courses" className="hidden items-center gap-1 text-sm font-medium text-secondary hover:underline sm:flex">
            عرض الكل <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        {courses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course._id} course={course} />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted">لا توجد دورات متاحة حالياً</p>
        )}
      </Section>

      <Section>
        <div className="mb-10 flex items-end justify-between">
          <Title badge="فريقنا" title="أساتذتنا" subtitle="تعرف على نخبة من الأساتذة المتميزين" />
          <Link href="/teachers" className="hidden items-center gap-1 text-sm font-medium text-secondary hover:underline sm:flex">
            عرض الكل <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        {teachers.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {teachers.map((teacher) => (
              <TeacherCard key={teacher._id} teacher={teacher} />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted">لا يوجد أساتذة متاحون حالياً</p>
        )}
      </Section>

      <TestimonialsSection />

      <Section background="white">
        <div className="mb-10 flex items-end justify-between">
          <Title badge="الأخبار" title="آخر الأخبار" subtitle="تابع آخر مستجدات الأكاديمية" />
          <Link href="/news" className="hidden items-center gap-1 text-sm font-medium text-secondary hover:underline sm:flex">
            عرض الكل <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockNews.slice(0, 3).map((item, i) => (
            <NewsCard key={item._id} news={item} featured={i === 0} />
          ))}
        </div>
      </Section>

      <CtaSection />
      <MapSection />
    </>
  );
}
