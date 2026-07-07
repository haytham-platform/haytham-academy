"use client";

import { MapPin, Phone, Clock } from "lucide-react";
import Section from "@/components/ui/Section";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import { ACADEMY } from "@/lib/constants";

export default function MapSection() {
  return (
    <Section id="location">
      <Title
        badge="موقعنا"
        title="زورونا في الأكاديمية"
        subtitle="نحن في خدمتكم في موقع استراتيجي يسهل الوصول إليه"
        align="center"
        className="mb-12"
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 !p-0 overflow-hidden">
          <div
            className="flex h-72 items-center justify-center bg-gradient-to-br from-blue-100 to-gray-100 md:h-96"
            role="img"
            aria-label="خريطة موقع الأكاديمية"
          >
            <div className="text-center">
              <MapPin className="mx-auto h-12 w-12 text-primary" />
              <p className="mt-3 font-medium text-foreground">خريطة الموقع</p>
              <p className="mt-1 text-sm text-muted">{ACADEMY.address}</p>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <MapPin className="mb-3 h-5 w-5 text-primary" />
            <h3 className="font-bold">العنوان</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{ACADEMY.address}</p>
          </Card>
          <Card>
            <Phone className="mb-3 h-5 w-5 text-primary" />
            <h3 className="font-bold">الهاتف</h3>
            <a href={`tel:${ACADEMY.phone}`} className="mt-2 block text-sm text-secondary hover:underline">
              {ACADEMY.phone}
            </a>
          </Card>
          <Card>
            <Clock className="mb-3 h-5 w-5 text-primary" />
            <h3 className="font-bold">ساعات العمل</h3>
            <p className="mt-2 text-sm text-muted">السبت - الخميس: 8:00 - 20:00</p>
            <p className="text-sm text-muted">الجمعة: مغلق</p>
          </Card>
        </div>
      </div>
    </Section>
  );
}
