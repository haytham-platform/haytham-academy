"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";

interface Teacher {
  _id: string;
  name: string;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  teacher: Teacher;
  department: string;
  price: number;
  image: string;
  level: string;
  duration: string;
  startDate: string;
  endDate?: string;
  studyDays: string;
  startTime: string;
  endTime: string;
  room: string;
  color: string;
  seats: number;
  remainingSeats: number;
  isActive: boolean;
}

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

const emptyForm = {
  title: "",
  description: "",
  teacher: "",
  department: "",
  price: "",
  image: "",
  level: "",
  duration: "",
  startDate: "",
  endDate: "",
  studyDays: "",
  startTime: "",
  endTime: "",
  room: "",
  color: "#6366f1",
  seats: "",
};

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
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

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const [coursesRes, teachersRes] = await Promise.all([
        fetch(`/api/admin/courses?page=${page}&limit=10${search ? `&search=${encodeURIComponent(search)}` : ""}`),
        fetch("/api/admin/teachers?limit=100"),
      ]);
      const coursesData = await coursesRes.json();
      const teachersData = await teachersRes.json();
      if (active) {
        setCourses(coursesData.courses || []);
        if (coursesData.pagination) setPagination(coursesData.pagination);
        setTeachers(teachersData.teachers || []);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page, search, refreshKey]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId ? `/api/admin/courses/${editingId}` : "/api/admin/courses";
    await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        seats: Number(form.seats),
      }),
    });
    resetForm();
    reload();
  }

  function startEdit(c: Course) {
    setEditingId(c._id);
    setForm({
      title: c.title,
      description: c.description,
      teacher: c.teacher?._id || "",
      department: c.department || "",
      price: String(c.price),
      image: c.image || "",
      level: c.level,
      duration: c.duration,
      startDate: c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : "",
      endDate: c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : "",
      studyDays: c.studyDays || "",
      startTime: c.startTime || "",
      endTime: c.endTime || "",
      room: c.room || "",
      color: c.color || "#6366f1",
      seats: String(c.seats),
    });
    setShowForm(true);
  }

  async function toggleActive(c: Course) {
    await fetch(`/api/admin/courses/${c._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف الدورة؟")) return;
    await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Title title="إدارة الدورات" subtitle="CRUD كامل للدورات التعليمية" />
        <Button onClick={() => { resetForm(); setShowForm(true); }}>+ إضافة دورة</Button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); reload(); }} className="mb-6 flex gap-2">
        <input className="input-field max-w-md" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-primary !px-4 !py-2">بحث</button>
      </form>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-border p-6">
          <h3 className="mb-4 font-bold">{editingId ? "تعديل دورة" : "إضافة دورة"}</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div><label className="text-xs text-muted">الاسم</label><input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label className="text-xs text-muted">الأستاذ</label><select className="input-field" value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })} required><option value="">اختر</option>{teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
            <div><label className="text-xs text-muted">القسم</label><input className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div><label className="text-xs text-muted">المستوى</label><input className="input-field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} required /></div>
            <div><label className="text-xs text-muted">السعر</label><input type="number" className="input-field" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
            <div><label className="text-xs text-muted">المقاعد</label><input type="number" className="input-field" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} required /></div>
            <div><label className="text-xs text-muted">المدة</label><input className="input-field" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} required /></div>
            <div><label className="text-xs text-muted">تاريخ البداية</label><input type="date" className="input-field" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
            <div><label className="text-xs text-muted">تاريخ النهاية</label><input type="date" className="input-field" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div><label className="text-xs text-muted">أيام الدراسة</label><input className="input-field" placeholder="السبت، الأحد..." value={form.studyDays} onChange={(e) => setForm({ ...form, studyDays: e.target.value })} /></div>
            <div><label className="text-xs text-muted">وقت البداية</label><input className="input-field" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><label className="text-xs text-muted">وقت النهاية</label><input className="input-field" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
            <div><label className="text-xs text-muted">القاعة</label><input className="input-field" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
            <div><label className="text-xs text-muted">اللون</label><input type="color" className="input-field h-10" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="text-xs text-muted">الوصف</label><textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
            <div><label className="text-xs text-muted">رابط الصورة</label><input className="input-field" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex gap-2"><Button type="submit">حفظ</Button><button type="button" onClick={resetForm} className="text-sm text-muted">إلغاء</button></div>
        </form>
      )}

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : courses.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="p-3">الدورة</th>
                  <th className="p-3">الأستاذ</th>
                  <th className="p-3">السعر</th>
                  <th className="p-3">المقاعد</th>
                  <th className="p-3">المتبقي</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c._id} className="border-b border-border">
                    <td className="p-3"><span className="inline-block h-3 w-3 rounded-full ml-2" style={{ backgroundColor: c.color }} />{c.title}</td>
                    <td className="p-3">{c.teacher?.name}</td>
                    <td className="p-3">{c.price} د.ج</td>
                    <td className="p-3">{c.seats}</td>
                    <td className="p-3">{c.remainingSeats}</td>
                    <td className="p-3"><span className={`badge ${c.isActive ? "badge-active" : "badge-inactive"}`}>{c.isActive ? "نشطة" : "موقوفة"}</span></td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(c)} className="text-primary hover:underline">تعديل</button>
                        <button type="button" onClick={() => toggleActive(c)} className="text-amber-600 hover:underline">{c.isActive ? "إيقاف" : "تفعيل"}</button>
                        <button type="button" onClick={() => handleDelete(c._id)} className="text-red-600 hover:underline">حذف</button>
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
        <p className="text-muted">لا توجد دورات</p>
      )}
    </div>
  );
}
