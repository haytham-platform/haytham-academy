"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import ConfirmModal from "@/components/ui/ConfirmModal";
import TransportNav from "@/components/transport/TransportNav";
import { hasPermission } from "@/lib/permissions";
import { ROUTE_STATUS_LABELS } from "@/lib/transport-labels";
import type { UserRole } from "@/types";

interface RouteRow {
  _id: string;
  name: string;
  description: string;
  status: string;
  notes: string;
}

const emptyForm = { name: "", description: "", status: "active", notes: "" };

export default function TransportRoutesPage() {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasPrev: false, hasNext: false });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      const role = d.user?.role as UserRole;
      if (role) {
        setCanManage(hasPermission(role, "transport.manage"));
        setCanDelete(role === "admin");
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/transport/routes?page=${page}&limit=10`)
      .then((r) => r.json())
      .then((data) => {
        if (active) {
          setRoutes(data.routes || []);
          if (data.pagination) setPagination(data.pagination);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [page, refreshKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId ? `/api/admin/transport/routes/${editingId}` : "/api/admin/transport/routes";
    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      setRefreshKey((k) => k + 1);
    } else {
      const data = await res.json();
      alert(data.error || "حدث خطأ");
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Title title="خطوط السير" subtitle="إدارة خطوط النقل" />
        {canManage && <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>+ إضافة خط</Button>}
      </div>
      <TransportNav />

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-border p-6">
          <h3 className="mb-4 font-bold">{editingId ? "تعديل خط" : "إضافة خط"}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input-field" placeholder="اسم الخط" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
            <input className="input-field md:col-span-2" placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="input-field md:col-span-2" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="mt-4 flex gap-2"><Button type="submit">حفظ</Button><button type="button" onClick={() => setShowForm(false)}>إلغاء</button></div>
        </form>
      )}

      {loading ? <p className="text-muted">جاري التحميل...</p> : routes.length === 0 ? (
        <p className="text-muted">لا توجد خطوط</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead><tr className="border-b border-border text-right"><th className="p-3">الخط</th><th className="p-3">الوصف</th><th className="p-3">الحالة</th>{canManage && <th className="p-3">إجراءات</th>}</tr></thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r._id} className="border-b border-border">
                    <td className="p-3">{r.name}</td>
                    <td className="p-3">{r.description || "—"}</td>
                    <td className="p-3">{ROUTE_STATUS_LABELS[r.status as keyof typeof ROUTE_STATUS_LABELS] ?? r.status}</td>
                    {canManage && (
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button type="button" className="text-primary" onClick={() => { setEditingId(r._id); setForm(r); setShowForm(true); }}>تعديل</button>
                          {canDelete && <button type="button" className="text-red-600" onClick={() => setDeleteId(r._id)}>حذف</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} onPageChange={setPage} />
        </>
      )}

      <ConfirmModal open={Boolean(deleteId)} title="حذف الخط" message="هل أنت متأكد؟" onConfirm={async () => { if (deleteId) { await fetch(`/api/admin/transport/routes/${deleteId}`, { method: "DELETE" }); setDeleteId(null); setRefreshKey((k) => k + 1); } }} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
