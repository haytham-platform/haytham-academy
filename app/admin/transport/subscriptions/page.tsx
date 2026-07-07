"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import TransportNav from "@/components/transport/TransportNav";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import { parseApiErrorBody, type ValidationErrorItem } from "@/lib/api-errors";
import { hasPermission } from "@/lib/permissions";
import { TRANSPORT_STATUS_LABELS } from "@/lib/transport-labels";
import { formatDate } from "@/lib/finance-labels";
import type { UserRole } from "@/types";

interface Subscription {
  _id: string;
  studentId: { name?: string; phone?: string };
  busId: { busName?: string; routeId?: { name?: string }; driverId?: { name?: string } };
  startDate: string;
  endDate: string;
  status: string;
  pickupPoint: string;
  dropoffPoint: string;
  notes?: string;
}

export default function TransportSubscriptionsPage() {
  const [rows, setRows] = useState<Subscription[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasPrev: false, hasNext: false });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [meta, setMeta] = useState<{ students: { _id: string; name: string; phone?: string }[]; buses: { _id: string; busName: string; routeName?: string }[] }>({ students: [], buses: [] });
  const [form, setForm] = useState({
    studentId: "",
    busId: "",
    startDate: "",
    endDate: "",
    pickupPoint: "",
    dropoffPoint: "",
    notes: "",
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      const role = d.user?.role as UserRole;
      if (role) setCanWrite(hasPermission(role, "transport.manage") || hasPermission(role, "transport.record"));
    });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/transport/subscriptions?${params}`);
      const data = await res.json();
      if (active) {
        setRows(data.subscriptions || []);
        if (data.pagination) setPagination(data.pagination);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page, statusFilter, refreshKey]);

  async function openForm() {
    setError("");
    setValidationErrors([]);
    const res = await fetch("/api/admin/transport/meta");
    const data = await res.json();
    setMeta({ students: data.students || [], buses: data.buses || [] });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setValidationErrors([]);
    const res = await fetch("/api/admin/transport/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setShowForm(false);
      setRefreshKey((k) => k + 1);
    } else {
      const parsed = parseApiErrorBody(data);
      setError(parsed.message);
      setValidationErrors(parsed.validationErrors ?? []);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Title title="تسجيل الطلاب" subtitle="تسجيل الطلاب في خدمة النقل المجانية" />
        {canWrite && <Button onClick={openForm}>+ تسجيل طالب</Button>}
      </div>
      <TransportNav />

      <div className="mb-4 flex gap-2">
        <select className="input-field max-w-xs" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">كل الحالات</option>
          {Object.entries(TRANSPORT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-border p-6">
          <h3 className="mb-4 font-bold">تسجيل طالب في النقل</h3>
          <ApiErrorAlert error={error} validationErrors={validationErrors} />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <select className="input-field" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">اختر الطالب</option>
              {meta.students.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.phone}</option>)}
            </select>
            <select className="input-field" required value={form.busId} onChange={(e) => setForm({ ...form, busId: e.target.value })}>
              <option value="">اختر الحافلة</option>
              {meta.buses.map((b) => <option key={b._id} value={b._id}>{b.busName} — {b.routeName}</option>)}
            </select>
            <input type="date" className="input-field" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <input type="date" className="input-field" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            <input className="input-field" placeholder="نقطة الصعود" required value={form.pickupPoint} onChange={(e) => setForm({ ...form, pickupPoint: e.target.value })} />
            <input className="input-field" placeholder="نقطة النزول" required value={form.dropoffPoint} onChange={(e) => setForm({ ...form, dropoffPoint: e.target.value })} />
            <input className="input-field md:col-span-2" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="mt-4 flex gap-2"><Button type="submit">تسجيل</Button><button type="button" onClick={() => setShowForm(false)}>إلغاء</button></div>
        </form>
      )}

      {loading ? <p className="text-muted">جاري التحميل...</p> : rows.length === 0 ? (
        <p className="text-muted">لا توجد تسجيلات</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="p-3">الطالب</th>
                  <th className="p-3">الحافلة</th>
                  <th className="p-3">نقطة الصعود</th>
                  <th className="p-3">نقطة النزول</th>
                  <th className="p-3">الفترة</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s._id} className="border-b border-border">
                    <td className="p-3">{s.studentId?.name}<br /><span className="text-xs text-muted">{s.studentId?.phone}</span></td>
                    <td className="p-3">{s.busId?.busName}</td>
                    <td className="p-3">{s.pickupPoint}</td>
                    <td className="p-3">{s.dropoffPoint}</td>
                    <td className="p-3">{formatDate(s.startDate)} — {formatDate(s.endDate)}</td>
                    <td className="p-3">{TRANSPORT_STATUS_LABELS[s.status as keyof typeof TRANSPORT_STATUS_LABELS] ?? s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
