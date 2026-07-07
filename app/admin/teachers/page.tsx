"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";

interface Teacher {
  _id: string;
  name: string;
  subject: string;
  phone: string;
  teachingLevel: string;
  adminShare?: number;
  teacherShare?: number;
  isActive: boolean;
}

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

const emptyForm = {
  name: "",
  subject: "",
  phone: "",
  teachingLevel: "",
  adminShare: "",
};

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const computedTeacherShare =
    form.adminShare !== "" && !Number.isNaN(Number(form.adminShare))
      ? 100 - Number(form.adminShare)
      : null;

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/teachers?${params}`);
      const data = await res.json();
      if (active) {
        setTeachers(data.teachers || []);
        if (data.pagination) setPagination(data.pagination);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page, search, refreshKey]);

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId ? `/api/admin/teachers/${editingId}` : "/api/admin/teachers";
    await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        adminShare: form.adminShare === "" ? undefined : Number(form.adminShare),
      }),
    });
    resetForm();
    reload();
  }

  function startEdit(t: Teacher) {
    setEditingId(t._id);
    setForm({
      name: t.name,
      subject: t.subject,
      phone: t.phone,
      teachingLevel: t.teachingLevel,
      adminShare: t.adminShare !== undefined ? String(t.adminShare) : "",
    });
    setShowForm(true);
  }

  async function toggleActive(t: Teacher) {
    await fetch(`/api/admin/teachers/${t._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف الأستاذ؟ (حذف منطقي)")) return;
    await fetch(`/api/admin/teachers/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Title title="إدارة الأساتذة" subtitle="CRUD كامل للأساتذة" />
        <Button onClick={() => { resetForm(); setShowForm(true); }}>+ إضافة أستاذ</Button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); reload(); }} className="mb-6 flex gap-2">
        <input className="input-field max-w-md" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-primary !px-4 !py-2">بحث</button>
      </form>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-border p-6">
          <h3 className="mb-4 font-bold">{editingId ? "تعديل أستاذ" : "إضافة أستاذ"}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                { key: "name", label: "الاسم واللقب", type: "text", required: true },
                { key: "phone", label: "رقم الهاتف", type: "tel", required: true },
                { key: "subject", label: "المادة", type: "text", required: true },
                { key: "teachingLevel", label: "السنة/المستوى الذي يدرّسه", type: "text", required: true },
                { key: "adminShare", label: "نسبة الإدارة (%)", type: "number", min: 0, max: 100 },
              ] satisfies {
                key: keyof typeof emptyForm;
                label: string;
                type: React.HTMLInputTypeAttribute;
                required?: boolean;
                min?: number;
                max?: number;
              }[]
            ).map(({ key, label, type, required, min, max }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-muted">{label}</label>
                <input
                  type={type}
                  className="input-field"
                  required={Boolean(required)}
                  min={min}
                  max={max}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs text-muted">نسبة الأستاذ (%)</label>
              <input
                type="text"
                className="input-field bg-muted/30"
                readOnly
                value={computedTeacherShare !== null ? `${computedTeacherShare}%` : "—"}
              />
              <p className="mt-1 text-xs text-muted">تُحسب تلقائياً: 100 − نسبة الإدارة</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit">حفظ</Button>
            <button type="button" onClick={resetForm} className="text-sm text-muted">إلغاء</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : teachers.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="p-3">الاسم</th>
                  <th className="p-3">المادة</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">السنة/المستوى</th>
                  <th className="p-3">نسبة الإدارة</th>
                  <th className="p-3">نسبة الأستاذ</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t._id} className="border-b border-border">
                    <td className="p-3">{t.name}</td>
                    <td className="p-3">{t.subject}</td>
                    <td className="p-3">{t.phone}</td>
                    <td className="p-3">{t.teachingLevel || "—"}</td>
                    <td className="p-3">{t.adminShare !== undefined ? `${t.adminShare}%` : "—"}</td>
                    <td className="p-3">{t.teacherShare !== undefined ? `${t.teacherShare}%` : "—"}</td>
                    <td className="p-3">
                      <span className={`badge ${t.isActive ? "badge-active" : "badge-inactive"}`}>
                        {t.isActive ? "نشط" : "موقوف"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(t)} className="text-primary hover:underline">تعديل</button>
                        <button type="button" onClick={() => toggleActive(t)} className="text-amber-600 hover:underline">{t.isActive ? "إيقاف" : "تفعيل"}</button>
                        <button type="button" onClick={() => handleDelete(t._id)} className="text-red-600 hover:underline">حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} onPageChange={setPage} />
        </>
      ) : (
        <p className="text-muted">لا يوجد أساتذة</p>
      )}
    </div>
  );
}
