"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@/types";
import StudentTransportSection from "@/components/transport/StudentTransportSection";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import { parseApiErrorBody, type ValidationErrorItem } from "@/lib/api-errors";

interface Student {
  _id: string;
  name: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  wilaya?: string;
  commune?: string;
  studyLevel?: string;
  institution?: string;
  notes?: string;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

const emptyForm = {
  name: "",
  phone: "",
  password: "",
  gender: "",
  dateOfBirth: "",
  guardianName: "",
  guardianPhone: "",
  address: "",
  wilaya: "",
  commune: "",
  studyLevel: "",
  institution: "",
  notes: "",
  isActive: true,
};

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });
  const [search, setSearch] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState("");
  const [deletedOnly, setDeletedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const role = d.user?.role as UserRole;
        if (role) setCanManage(hasPermission(role, "students.manage"));
      });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      if (wilaya) params.set("wilaya", wilaya);
      if (isActiveFilter) params.set("isActive", isActiveFilter);
      if (deletedOnly) params.set("deletedOnly", "true");
      const res = await fetch(`/api/admin/students?${params}`);
      const data = await res.json();
      if (active) {
        setStudents(data.students || []);
        if (data.pagination) setPagination(data.pagination);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page, search, wilaya, isActiveFilter, deletedOnly, refreshKey]);

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError("");
    setValidationErrors([]);
  }

  function startEdit(student: Student) {
    setEditingId(student._id);
    setForm({
      name: student.name,
      phone: student.phone || "",
      password: "",
      gender: student.gender || "",
      dateOfBirth: student.dateOfBirth
        ? new Date(student.dateOfBirth).toISOString().slice(0, 10)
        : "",
      guardianName: student.guardianName || "",
      guardianPhone: student.guardianPhone || "",
      address: student.address || "",
      wilaya: student.wilaya || "",
      commune: student.commune || "",
      studyLevel: student.studyLevel || "",
      institution: student.institution || "",
      notes: student.notes || "",
      isActive: student.isActive,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setValidationErrors([]);
    const url = editingId ? `/api/admin/students/${editingId}` : "/api/admin/students";
    const method = editingId ? "PUT" : "POST";
    const body = { ...form };
    if (editingId && !body.password) delete (body as { password?: string }).password;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      const parsed = parseApiErrorBody(data);
      setError(parsed.message);
      setValidationErrors(parsed.validationErrors ?? []);
      return;
    }
    setMessage(editingId ? "تم تحديث الطالب" : "تم إضافة الطالب");
    resetForm();
    reload();
  }

  async function softDelete(id: string) {
    if (!confirm("حذف الطالب؟ (حذف منطقي)")) return;
    await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
    reload();
  }

  async function restore(id: string) {
    await fetch(`/api/admin/students/${id}/restore`, { method: "POST" });
    reload();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Title title="إدارة الطلاب" subtitle="إضافة وتعديل وبحث الطلاب" />
        {canManage && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            + إضافة طالب
          </Button>
        )}
      </div>

      {message && <p className="mb-4 text-sm text-green-600">{message}</p>}

      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); reload(); }}
        className="mb-6 grid gap-3 md:grid-cols-4"
      >
        <input className="input-field" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="input-field" placeholder="الولاية" value={wilaya} onChange={(e) => setWilaya(e.target.value)} />
        <select className="input-field" value={isActiveFilter} onChange={(e) => setIsActiveFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="true">نشط</option>
          <option value="false">موقوف</option>
        </select>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={deletedOnly} onChange={(e) => setDeletedOnly(e.target.checked)} />
            المحذوفون
          </label>
          <button type="submit" className="btn-primary !px-4 !py-2">بحث</button>
        </div>
      </form>

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-border bg-white p-6">
          <h3 className="mb-4 font-bold">{editingId ? "تعديل طالب" : "إضافة طالب"}</h3>
          <ApiErrorAlert error={error} validationErrors={validationErrors} />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(
              [
                { key: "name", label: "الاسم الكامل", type: "text", required: true },
                { key: "phone", label: "الهاتف", type: "tel", required: true },
                {
                  key: "password",
                  label: editingId ? "كلمة المرور (اختياري)" : "كلمة المرور",
                  type: "password",
                  required: !editingId,
                },
                { key: "dateOfBirth", label: "تاريخ الميلاد", type: "date" },
                { key: "guardianName", label: "اسم الولي", type: "text" },
                { key: "guardianPhone", label: "هاتف الولي", type: "text" },
                { key: "address", label: "العنوان", type: "text" },
                { key: "wilaya", label: "الولاية", type: "text" },
                { key: "commune", label: "البلدية", type: "text" },
                { key: "studyLevel", label: "المستوى الدراسي", type: "text" },
                { key: "institution", label: "المؤسسة", type: "text" },
              ] satisfies {
                key: keyof typeof emptyForm;
                label: string;
                type: React.HTMLInputTypeAttribute;
                required?: boolean;
              }[]
            ).map(({ key, label, type, required }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-muted">{label}</label>
                <input
                  type={type}
                  className="input-field"
                  required={Boolean(required)}
                  value={(form as Record<string, string | boolean>)[key] as string}
                  onChange={(e) =>
                    setForm({ ...form, [key]: e.target.value })
                  }
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs text-muted">الجنس</label>
              <select
                className="input-field"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted">ملاحظات</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span className="text-sm">نشط</span>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit">{editingId ? "حفظ" : "إضافة"}</Button>
            <button type="button" onClick={resetForm} className="text-sm text-muted hover:underline">إلغاء</button>
          </div>
        </form>
      )}

      <StudentTransportSection key={editingId ?? "none"} studentId={editingId} />

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : students.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="p-3">الاسم</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">الولاية</th>
                  <th className="p-3">المستوى</th>
                  <th className="p-3">الحالة</th>
                  {canManage && <th className="p-3">إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s._id} className="border-b border-border">
                    <td className="p-3">{s.name}</td>
                    <td className="p-3">{s.phone}</td>
                    <td className="p-3">{s.wilaya || "—"}</td>
                    <td className="p-3">{s.studyLevel || "—"}</td>
                    <td className="p-3">
                      <span className={`badge ${s.deletedAt ? "badge-inactive" : s.isActive ? "badge-active" : "badge-inactive"}`}>
                        {s.deletedAt ? "محذوف" : s.isActive ? "نشط" : "موقوف"}
                      </span>
                    </td>
                    {canManage && (
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => startEdit(s)} className="text-primary hover:underline">تعديل</button>
                          {!s.deletedAt ? (
                            <button type="button" onClick={() => softDelete(s._id)} className="text-red-600 hover:underline">حذف</button>
                          ) : (
                            <button type="button" onClick={() => restore(s._id)} className="text-green-600 hover:underline">استرجاع</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} hasPrev={pagination.hasPrev} hasNext={pagination.hasNext} onPageChange={setPage} />
        </>
      ) : (
        <p className="text-muted">لا يوجد طلاب</p>
      )}
    </div>
  );
}
