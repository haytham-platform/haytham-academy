"use client";

import { ArrowLeft, Phone } from "lucide-react";
import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import { ACADEMY } from "@/lib/constants";

export default function CtaSection() {
  return (
    <Section background="white">
      <div className="overflow-hidden rounded-3xl gradient-hero px-8 py-14 text-center md:px-16">
        <h2 className="text-2xl font-bold text-white md:text-4xl">
          ابدأ رحلتك التعليمية اليوم
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pink-100">
          انضم إلى آلاف الطلاب الذين حققوا النجاح معنا. سجل الآن واختر الدورة
          المناسبة لك.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button href="/register" variant="accent" size="lg">
            إنشاء حساب مجاني
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            href={`tel:${ACADEMY.phone}`}
            variant="outline"
            size="lg"
            className="!border-white/30 !bg-white/10 !text-white hover:!bg-white/20"
          >
            <Phone className="h-4 w-4" />
            {ACADEMY.phone}
          </Button>
        </div>
      </div>
    </Section>
  );
}
