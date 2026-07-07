"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import StatusBadge from "@/components/ui/StatusBadge";
import { hasPermission } from "@/lib/permissions";
import type { EnrollmentStatus, UserRole } from "@/types";

interface Enrollment {
  _id: string;
  student: { name?: string; phone?: string };
  course: { title?: string; remainingSeats?: number };
  status: EnrollmentStatus;
  createdAt: string;
}

interface MetaStudent {
  _id: string;
  name: string;
  phone?: string;
}

interface MetaCourse {
  _id: string;
  title: string;
  remainingSeats: number;
}

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function AdminEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [students, setStudents] = useState<MetaStudent[]>([]);
  const [courses, setCourses] = useState<MetaCourse[]>([]);
  const [form, setForm] = useState({ studentId: "", courseId: "", status: "pending" as EnrollmentStatus });
  const [refreshKey, setRefreshKey] = useState(0);

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const role = d.user?.role as UserRole;
        if (role) setCanManage(hasPermission(role, "enrollments.manage"));
      });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/enrollments?${params}`);
      const data = await res.json();
      if (active) {
        setEnrollments(data.enrollments || []);
        if (data.pagination) setPagination(data.pagination);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page, statusFilter, search, refreshKey]);

  async function openCreateForm() {
    const res = await fetch("/api/admin/enrollments/meta");
    const data = await res.json();
    setStudents(data.students || []);
    setCourses(data.courses || []);
    setShowForm(true);
  }

  async function createEnrollment(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ studentId: "", courseId: "", status: "pending" });
      reload();
    } else {
      const data = await res.json();
      alert(data.error || "حدث خطأ");
    }
  }

  async function updateStatus(id: string, status: EnrollmentStatus) {
    await fetch(`/api/admin/enrollments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    reload();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Title title="إدارة التسجيلات" subtitle="تسجيل الطلاب في الدورات" />
        {canManage && <Button onClick={openCreateForm}>+ تسجيل جديد</Button>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); reload(); }} className="mb-6 flex flex-wrap gap-2">
        <input className="input-field max-w-xs" placeholder="بحث بالطالب..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input-field max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">مقبول</option>
          <option value="rejected">مرفوض</option>
          <option value="cancelled">ملغى</option>
        </select>
        <button type="submit" className="btn-primary !px-4 !py-2">بحث</button>
      </form>

      {showForm && (
        <form onSubmit={createEnrollment} className="mb-8 rounded-2xl border border-border p-6">
          <h3 className="mb-4 font-bold">تسجيل طالب في دورة</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="input-field" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required>
              <option value="">اختر الطالب</option>
              {students.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.phone}</option>)}
            </select>
            <select className="input-field" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} required>
              <option value="">اختر الدورة</option>
              {courses.map((c) => <option key={c._id} value={c._id}>{c.title} ({c.remainingSeats} مقعد)</option>)}
            </select>
            <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EnrollmentStatus })}>
              <option value="pending">قيد المراجعة</option>
              <option value="approved">مقبول</option>
            </select>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit">تسجيل</Button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted">إلغاء</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : enrollments.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="p-3">الطالب</th>
                  <th className="p-3">الدورة</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e._id} className="border-b border-border">
                    <td className="p-3">
                      <p>{e.student?.name}</p>
                      <p className="text-xs text-muted">{e.student?.phone}</p>
                    </td>
                    <td className="p-3">{e.course?.title}</td>
                    <td className="p-3"><StatusBadge status={e.status} /></td>
                    <td className="p-3">
                      {canManage && (
                        <div className="flex flex-wrap gap-2">
                          {e.status === "pending" && (
                            <>
                              <button type="button" onClick={() => updateStatus(e._id, "approved")} className="text-green-600 hover:underline">قبول</button>
                              <button type="button" onClick={() => updateStatus(e._id, "rejected")} className="text-red-600 hover:underline">رفض</button>
                            </>
                          )}
                          {(e.status === "pending" || e.status === "approved") && (
                            <button type="button" onClick={() => updateStatus(e._id, "cancelled")} className="text-amber-600 hover:underline">إلغاء</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} onPageChange={setPage} />
        </>
      ) : (
        <p className="text-muted">لا توجد تسجيلات</p>
      )}
    </div>
  );
}
