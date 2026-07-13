"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Title from "@/components/ui/Title";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";

export default function EditAcademicSeasonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", code: "", startDate: "", endDate: "", status: "draft", isOpenForRegistration: false, description: "", notes: "" });
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/admin/academic-seasons/${id}`).then((r) => r.json()).then((data) => {
      const s = data.season;
      if (s) setForm({ name: s.name || "", code: s.code || "", startDate: s.startDate?.slice(0, 10) || "", endDate: s.endDate?.slice(0, 10) || "", status: s.status || "draft", isOpenForRegistration: Boolean(s.isOpenForRegistration), description: s.description || "", notes: s.notes || "" });
    }).catch(() => setError("تعذر تحميل الموسم"));
  }, [id]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/academic-seasons/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "تعذر التحديث");
    router.push(`/admin/academic-seasons/${id}`);
  }
  return (
    <div dir="rtl">
      <Title title="تعديل الموسم الدراسي" subtitle="التعديل متاح للمواسم المسودة أو القادمة فقط." className="mb-6" />
      {error && <ApiErrorAlert error={error} />}
      <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border bg-white p-5 md:grid-cols-2">
        <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <input className="input-field" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
        <input className="input-field" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
        <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">مسودة</option><option value="upcoming">قادم</option></select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isOpenForRegistration} onChange={(e) => setForm({ ...form, isOpenForRegistration: e.target.checked })} /> مفتوح للتسجيل</label>
        <textarea className="input-field md:col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <textarea className="input-field md:col-span-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="md:col-span-2"><button className="btn-primary">حفظ التعديلات</button></div>
      </form>
    </div>
  );
}
