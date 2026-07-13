"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Title from "@/components/ui/Title";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";

export default function SeasonRolloverPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState({ sourceSeason: "", targetSeason: "", action: "promote", academicLevel: "", className: "", groupName: "", enrollmentType: "", targetAcademicLevel: "", targetClass: "", targetGroup: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function preview(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/academic-seasons/rollover-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceSeason: form.sourceSeason,
        targetSeason: form.targetSeason,
        targetSeasonId: id,
        action: form.action,
        scope: { academicLevel: form.academicLevel, className: form.className, groupName: form.groupName, enrollmentType: form.enrollmentType },
        target: { academicLevel: form.targetAcademicLevel, className: form.targetClass, groupName: form.targetGroup },
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error || "تعذر إنشاء المعاينة");
    router.push(`/admin/academic-seasons/${id}/preview?job=${data.job._id}`);
  }
  return (
    <div dir="rtl">
      <Title title="ترحيل الطلاب" subtitle="المعاينة إلزامية قبل التنفيذ. لا يتم نسخ المدفوعات أو الحضور أو النتائج." className="mb-6" />
      {error && <ApiErrorAlert error={error} />}
      <form onSubmit={preview} className="grid gap-4 rounded-lg border border-border bg-white p-5 md:grid-cols-2">
        <input className="input-field" placeholder="الموسم المصدر" value={form.sourceSeason} onChange={(e) => setForm({ ...form, sourceSeason: e.target.value })} required />
        <input className="input-field" placeholder="الموسم الهدف" value={form.targetSeason} onChange={(e) => setForm({ ...form, targetSeason: e.target.value })} required />
        <select className="input-field" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
          <option value="promote">ترقية</option><option value="repeat">إعادة</option><option value="transfer">تحويل</option><option value="graduate">تخرج</option><option value="withdraw">انسحاب</option><option value="archive">أرشفة</option><option value="keep">إبقاء</option><option value="move_class">تغيير القسم</option><option value="move_group">تغيير الفوج</option><option value="exclude">استبعاد</option>
        </select>
        <input className="input-field" placeholder="تصفية حسب المستوى" value={form.academicLevel} onChange={(e) => setForm({ ...form, academicLevel: e.target.value })} />
        <input className="input-field" placeholder="تصفية حسب القسم" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
        <input className="input-field" placeholder="تصفية حسب الفوج" value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} />
        <input className="input-field" placeholder="نوع التسجيل" value={form.enrollmentType} onChange={(e) => setForm({ ...form, enrollmentType: e.target.value })} />
        <input className="input-field" placeholder="المستوى الهدف" value={form.targetAcademicLevel} onChange={(e) => setForm({ ...form, targetAcademicLevel: e.target.value })} />
        <input className="input-field" placeholder="القسم الهدف" value={form.targetClass} onChange={(e) => setForm({ ...form, targetClass: e.target.value })} />
        <input className="input-field" placeholder="الفوج الهدف" value={form.targetGroup} onChange={(e) => setForm({ ...form, targetGroup: e.target.value })} />
        <div className="md:col-span-2"><button className="btn-primary" disabled={loading}>{loading ? "جاري إنشاء المعاينة..." : "إنشاء معاينة الترحيل"}</button></div>
      </form>
    </div>
  );
}
