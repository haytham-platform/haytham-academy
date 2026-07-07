import type { Metadata } from "next";
import { Target, Eye, Heart, BookOpen } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Title from "@/components/ui/Title";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import { StatsSection } from "@/components/home/ServicesSection";
import { ACADEMY } from "@/lib/constants";

export const metadata: Metadata = {
  title: "من نحن",
};

const values = [
  { title: "الجودة", description: "نلتزم بأعلى معايير التعليم", icon: Target },
  { title: "الشفافية", description: "تواصل واضح مع الطلاب وأولياء الأمور", icon: Eye },
  { title: "الاهتمام", description: "متابعة فردية لكل طالب", icon: Heart },
  { title: "التميز", description: "نسعى دائماً للتطور والابتكار", icon: BookOpen },
];

export default function AboutPage() {
  return (
    <>
      <div className="gradient-hero py-16 text-white md:py-20">
        <Container className="text-center">
          <Breadcrumb
            items={[{ label: "من نحن" }]}
            className="!mb-6 [&_a]:text-blue-200 [&_span]:text-white [&_svg]:text-blue-300"
          />
          <h1 className="text-3xl font-bold md:text-4xl">من نحن</h1>
          <p className="mx-auto mt-4 max-w-2xl text-blue-100">
            {ACADEMY.name} — رحلة تعليمية نحو التميز والنجاح
          </p>
        </Container>
      </div>

      <Section background="white">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <Title badge="قصتنا" title="نبذة عن الأكاديمية" />
            <p className="mt-6 leading-8 text-muted">
              {ACADEMY.name} مؤسسة تعليمية تهدف إلى تقديم دورات تدريبية
              وتعليمية عالية الجودة للطلاب في مختلف المراحل. تأسست الأكاديمية
              برؤية واضحة: تمكين كل طالب من تحقيق إمكاناته الكاملة من خلال
              تعليم متميز وبيئة محفزة.
            </p>
            <p className="mt-4 leading-8 text-muted">
              على مدار سنوات، ساعدنا آلاف الطلاب على النجاح في امتحاناتهم
              وتحقيق أهدافهم الأكاديمية. نفتخر بفريقنا من الأساتذة المتميزين
              وبرامجنا التعليمية المتنوعة.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {["1200+", "45+", "18+", "95%"].map((val, i) => (
              <Card key={i} className="text-center">
                <p className="text-2xl font-bold text-primary">{val}</p>
                <p className="mt-1 text-xs text-muted">
                  {["طالب", "دورة", "أستاذ", "نجاح"][i]}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-r-4 !border-r-primary">
            <Target className="mb-4 h-8 w-8 text-primary" />
            <h2 className="text-xl font-bold">رسالتنا</h2>
            <p className="mt-4 leading-8 text-muted">
              تمكين الطلاب من خلال تقديم تعليم متميز يركز على الجودة والتطبيق
              العملي، وإعداد جيل قادر على مواجهة تحديات المستقبل بثقة ومعرفة.
            </p>
          </Card>
          <Card className="border-r-4 !border-r-secondary">
            <Eye className="mb-4 h-8 w-8 text-secondary" />
            <h2 className="text-xl font-bold">رؤيتنا</h2>
            <p className="mt-4 leading-8 text-muted">
              أن نكون مرجعاً تعليمياً رائداً في المنطقة، معروفين بجودة برامجنا
              وتميز أساتذتنا ونجاح طلابنا في مختلف المجالات.
            </p>
          </Card>
        </div>
      </Section>

      <Section background="white">
        <Title
          badge="قيمنا"
          title="ما يميزنا"
          align="center"
          className="mb-10"
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map(({ title, description, icon: Icon }) => (
            <Card key={title} hover className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{description}</p>
            </Card>
          ))}
        </div>
      </Section>

      <StatsSection />
    </>
  );
}
