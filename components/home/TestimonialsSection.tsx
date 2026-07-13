"use client";

import { Star, Quote } from "lucide-react";
import Section from "@/components/ui/Section";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import type { AcademyTestimonialData } from "@/types/ui";

export default function TestimonialsSection({
  testimonials,
}: {
  testimonials: AcademyTestimonialData[];
}) {
  return (
    <Section background="muted" id="testimonials">
      <Title
        badge="آراء الطلاب"
        title="ماذا يقول طلابنا؟"
        subtitle="تجارب حقيقية من طلاب انضموا إلى أكاديميتنا"
        align="center"
        className="mb-12"
      />
      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map((item) => (
          <Card key={`${item.name}-${item.role}`} hover>
            <Quote className="mb-3 h-8 w-8 text-accent/60" aria-hidden="true" />
            <p className="text-sm leading-7 text-muted">{item.content}</p>
            <div className="mt-4 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < item.rating ? "fill-accent text-accent" : "text-gray-200"}`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {item.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold">{item.name}</p>
                <p className="text-xs text-muted">{item.role}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
