"use client";

import {
  GraduationCap,
  BookOpen,
  Languages,
  Briefcase,
  Users,
  BookMarked,
  Award,
  Trophy,
} from "lucide-react";
import Section from "@/components/ui/Section";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import { mockServices, mockStats } from "@/lib/mock-data";

const iconMap: Record<string, React.ElementType> = {
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  languages: Languages,
  briefcase: Briefcase,
  users: Users,
  book: BookMarked,
  award: Award,
  trophy: Trophy,
};

export function ServicesSection() {
  return (
    <Section background="white" id="services">
      <Title
        badge="خدماتنا"
        title="ماذا نقدم لك؟"
        subtitle="برامج تعليمية متنوعة مصممة لتلبية احتياجات كل طالب"
        align="center"
        className="mb-12"
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {mockServices.map((service) => {
          const Icon = iconMap[service.icon] || BookOpen;
          return (
            <Card key={service.title} hover className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-50 text-primary">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="font-bold text-foreground">{service.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{service.description}</p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

export function StatsSection() {
  return (
    <Section background="primary" className="!py-14">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {mockStats.map((stat) => {
          const Icon = iconMap[stat.icon] || Trophy;
          return (
            <div key={stat.label} className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
              </div>
              <p className="text-3xl font-bold text-white md:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-pink-200">{stat.label}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
