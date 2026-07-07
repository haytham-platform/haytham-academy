"use client";

import { useState } from "react";
import { Save, Building2, Phone } from "lucide-react";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { ACADEMY } from "@/lib/constants";

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: ACADEMY.name,
    phone: ACADEMY.phone,
    address: ACADEMY.address,
    description:
      "منصة تعليمية متخصصة في تقديم دورات عالية الجودة لمساعدة الطلاب على تحقيق أهدافهم.",
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div>
      <Title title="الإعدادات" subtitle="إدارة معلومات الأكاديمية العامة" className="mb-8" />

      <form onSubmit={handleSave} className="mx-auto max-w-2xl space-y-6">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-bold">معلومات الأكاديمية</h2>
          </div>
          <div className="space-y-4">
            <Input
              label="اسم الأكاديمية"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Textarea
              label="الوصف"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <h2 className="font-bold">معلومات التواصل</h2>
          </div>
          <div className="space-y-4">
            <Input
              label="رقم الهاتف"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="العنوان"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
        </Card>

        {saved && (
          <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700" role="status">
            تم حفظ الإعدادات بنجاح (واجهة فقط — الربط بقاعدة البيانات لاحقاً)
          </div>
        )}

        <Button type="submit" fullWidth size="lg">
          <Save className="h-4 w-4" />
          حفظ الإعدادات
        </Button>
      </form>
    </div>
  );
}
