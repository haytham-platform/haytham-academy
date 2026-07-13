"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Title from "@/components/ui/Title";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";

export default function NewAcademicSeasonPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", code: "", startDate: "", endDate: "", status: "draft", isOpenForRegistration: false, copyFromSeason: "", description: "", notes: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/academic-seasons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "تعذر إنشاء الموسم");
    router.push(`/admin/academic-seasons/${data.season._id}`);
  }
  return (
    <div dir="rtl">
      <Title title="موسم دراسي جديد" subtitle="انسخ الإعدادات فقط عند الحاجة، بدون نسخ أي تاريخ مالي أو أكاديمي." className="mb-6" />
      {error && <ApiErrorAlert error={error} />}
      <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border bg-white p-5 md:grid-cols-2">
        <input className="input-field" placeholder="اسم الموسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input-field" placeholder="الرمز مثل 2026-2027" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <input className="input-field" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
        <input className="input-field" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
        <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">مسودة</option><option value="upcoming">قادم</option></select>
        <input className="input-field" placeholder="نسخ إعدادات من موسم" value={form.copyFromSeason} onChange={(e) => setForm({ ...form, copyFromSeason: e.target.value })} />
        <textarea className="input-field md:col-span-2" placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <textarea className="input-field md:col-span-2" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isOpenForRegistration} onChange={(e) => setForm({ ...form, isOpenForRegistration: e.target.checked })} /> مفتوح للتسجيل</label>
        <div className="md:col-span-2"><button className="btn-primary" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ الموسم"}</button></div>
      </form>
    </div>
  );
}
