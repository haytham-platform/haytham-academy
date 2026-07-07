"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import ConfirmModal from "@/components/ui/ConfirmModal";
import TransportNav from "@/components/transport/TransportNav";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@/types";
import { BUS_STATUS_LABELS } from "@/lib/transport-labels";

interface Bus {
  _id: string;
  busName: string;
  plateNumber: string;
  driverId?: string;
  routeId?: string;
  driverName?: string;
  driverPhone?: string;
  routeName?: string;
  capacity: number;
  status: string;
  notes: string;
}

const emptyForm = {
  busName: "",
  plateNumber: "",
  driverId: "",
  routeId: "",
  capacity: "",
  status: "active",
  notes: "",
};

export default function TransportBusesPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<{ _id: string; name: string }[]>([]);
  const [routes, setRoutes] = useState<{ _id: string; name: string }[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasPrev: false, hasNext: false });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      const role = d.user?.role as UserRole;
      if (role) {
        setCanManage(hasPermission(role, "transport.manage"));
        setCanDelete(role === "admin");
      }
    });
    fetch("/api/admin/transport/meta").then((r) => r.json()).then((d) => {
      setDrivers(d.drivers || []);
      setRoutes(d.routes || []);
    });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/transport/buses?${params}`);
      const data = await res.json();
      if (active) {
        setBuses(data.buses || []);
        if (data.pagination) setPagination(data.pagination);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page, search, refreshKey]);

  function reload() { setRefreshKey((k) => k + 1); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId ? `/api/admin/transport/buses/${editingId}` : "/api/admin/transport/buses";
    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, capacity: Number(form.capacity) }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      reload();
    } else {
      const data = await res.json();
      alert(data.error || "حدث خطأ");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/admin/transport/buses/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteId(null);
    reload();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Title title="الحافلات" subtitle="إدارة أسطول النقل المجاني" />
        {canManage && <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>+ إضافة حافلة</Button>}
      </div>
      <TransportNav />

      <form onSubmit={(e) => { e.preventDefault(); setPage(1); reload(); }} className="mb-4 flex gap-2">
        <input className="input-field max-w-md" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn-primary !px-4 !py-2">بحث</button>
      </form>

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-border p-6">
          <h3 className="mb-4 font-bold">{editingId ? "تعديل حافلة" : "إضافة حافلة"}</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input className="input-field" placeholder="اسم الحافلة" required value={form.busName} onChange={(e) => setForm({ ...form, busName: e.target.value })} />
            <input className="input-field" placeholder="رقم اللوحة" required value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} />
            <select className="input-field" required value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">اختر السائق</option>
              {drivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
            <select className="input-field" required value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}>
              <option value="">اختر خط السير</option>
              {routes.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
            <input type="number" className="input-field" placeholder="السعة" required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">نشطة</option>
              <option value="inactive">غير نشطة</option>
              <option value="maintenance">صيانة</option>
            </select>
          </div>
          <div className="mt-4 flex gap-2"><Button type="submit">حفظ</Button><button type="button" onClick={() => setShowForm(false)}>إلغاء</button></div>
        </form>
      )}

      {loading ? <p className="text-muted">جاري التحميل...</p> : buses.length === 0 ? (
        <p className="text-muted">لا توجد حافلات</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="p-3">الحافلة</th>
                  <th className="p-3">اللوحة</th>
                  <th className="p-3">السائق</th>
                  <th className="p-3">الخط</th>
                  <th className="p-3">السعة</th>
                  <th className="p-3">الحالة</th>
                  {canManage && <th className="p-3">إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b._id} className="border-b border-border">
                    <td className="p-3">{b.busName}</td>
                    <td className="p-3">{b.plateNumber}</td>
                    <td className="p-3">{b.driverName}</td>
                    <td className="p-3">{b.routeName}</td>
                    <td className="p-3">{b.capacity}</td>
                    <td className="p-3">{BUS_STATUS_LABELS[b.status as keyof typeof BUS_STATUS_LABELS] ?? b.status}</td>
                    {canManage && (
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button type="button" className="text-primary" onClick={() => { setEditingId(b._id); setForm({ busName: b.busName, plateNumber: b.plateNumber, driverId: String(b.driverId ?? ""), routeId: String(b.routeId ?? ""), capacity: String(b.capacity), status: b.status, notes: b.notes }); setShowForm(true); }}>تعديل</button>
                          {canDelete && <button type="button" className="text-red-600" onClick={() => setDeleteId(b._id)}>حذف</button>}
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

      <ConfirmModal open={Boolean(deleteId)} title="حذف الحافلة" message="هل أنت متأكد من حذف هذه الحافلة؟" onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} loading={deleting} />
    </div>
  );
}
