"use client";

import { useState } from "react";
import { Phone, MapPin, Clock, Send } from "lucide-react";
import Container from "@/components/ui/Container";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ACADEMY } from "@/lib/constants";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return;
      }
      setSuccess(data.message);
      setForm({ name: "", phone: "", message: "" });
    } catch {
      setError("حدث خطأ أثناء إرسال الرسالة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-background py-10 md:py-14">
      <Container>
        <Breadcrumb items={[{ label: "تواصل معنا" }]} />
        <Title
          badge="تواصل"
          title="نحن هنا لمساعدتك"
          subtitle="لا تتردد في التواصل معنا لأي استفسار"
          className="mb-10"
        />

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <Phone className="mb-3 h-5 w-5 text-primary" />
              <h3 className="font-bold">الهاتف</h3>
              <a href={`tel:${ACADEMY.phone}`} className="mt-2 block text-secondary hover:underline">
                {ACADEMY.phone}
              </a>
            </Card>
            <Card>
              <MapPin className="mb-3 h-5 w-5 text-primary" />
              <h3 className="font-bold">العنوان</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{ACADEMY.address}</p>
            </Card>
            <Card>
              <Clock className="mb-3 h-5 w-5 text-primary" />
              <h3 className="font-bold">ساعات العمل</h3>
              <p className="mt-2 text-sm text-muted">السبت - الخميس: 8:00 - 20:00</p>
              <p className="text-sm text-muted">الجمعة: مغلق</p>
            </Card>

            <Card className="!p-0 overflow-hidden">
              <div
                className="flex h-48 items-center justify-center bg-gradient-to-br from-blue-100 to-gray-100"
                role="img"
                aria-label="خريطة موقع الأكاديمية"
              >
                <MapPin className="h-10 w-10 text-primary" />
              </div>
            </Card>
          </div>

          <Card className="lg:col-span-3 !shadow-soft-lg">
            <h3 className="text-lg font-bold">أرسل رسالة</h3>
            <p className="mt-1 text-sm text-muted">سنرد عليك في أقرب وقت ممكن</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {success && (
                <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700" role="status">{success}</div>
              )}
              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>
              )}

              <Input
                label="الاسم الكامل"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="رقم الهاتف"
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Textarea
                label="رسالتك"
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
              <Button type="submit" loading={loading} fullWidth size="lg">
                <Send className="h-4 w-4" />
                إرسال الرسالة
              </Button>
            </form>
          </Card>
        </div>
      </Container>
    </div>
  );
}
