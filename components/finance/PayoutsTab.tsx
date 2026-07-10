"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import {
  formatCurrency,
  formatDate,
  PAYOUT_TYPES,
} from "@/lib/finance-labels";

interface Payout {
  _id: string;
  teacherId: string;
  teacherName?: string;
  courseId?: string;
  courseTitle?: string;
  numberOfSessions: number;
  extraSessions: number;
  sessionRate: number;
  manualAdjustment: number;
  totalDue: number;
  paid: number;
  remaining: number;
  amount: number;
  payoutType: string;
  payoutDate: string;
  status: string;
  note?: string;
}

interface Option {
  _id: string;
  name?: string;
  title?: string;
}

const emptyForm = {
  teacherId: "",
  courseId: "",
  numberOfSessions: "0",
  extraSessions: "0",
  sessionRate: "0",
  manualAdjustment: "0",
  totalDue: "0",
  paid: "0",
  amount: "",
  payoutType: "fixed",
  payoutDate: new Date().toISOString().slice(0, 10),
  status: "pending",
  note: "",
};

export default function PayoutsTab() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [teacherFilter, setTeacherFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPayouts() {
    setLoading(true);
    const params = new URLSearchParams();
    if (teacherFilter) params.set("teacherId", teacherFilter);
    if (courseFilter) params.set("courseId", courseFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/admin/finance/teacher-payouts?${params}`);
    const data = await res.json();
    setPayouts(data.payouts || []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams();
      if (teacherFilter) params.set("teacherId", teacherFilter);
      if (courseFilter) params.set("courseId", courseFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const [pRes, tRes, cRes] = await Promise.all([
        fetch(`/api/admin/finance/teacher-payouts?${params}`),
        fetch("/api/admin/teachers"),
        fetch("/api/admin/courses"),
      ]);
      const pData = await pRes.json();
      const tData = await tRes.json();
      const cData = await cRes.json();
      if (active) {
        setPayouts(pData.payouts || []);
        setTeachers(tData.teachers || []);
        setCourses(cData.courses || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [teacherFilter, courseFilter, statusFilter, from, to]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = {
      ...form,
      amount: Number(form.paid || form.amount),
      paid: Number(form.paid || form.amount),
      numberOfSessions: Number(form.numberOfSessions),
      extraSessions: Number(form.extraSessions),
      sessionRate: Number(form.sessionRate),
      manualAdjustment: Number(form.manualAdjustment),
      totalDue: Number(form.totalDue),
      courseId: form.courseId || undefined,
    };
    const url = editingId
      ? `/api/admin/finance/teacher-payouts/${editingId}`
      : "/api/admin/finance/teacher-payouts";
    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setMessage(editingId ? "تم التحديث" : "تمت الإضافة");
    setModalOpen(false);
    loadPayouts();
    setTimeout(() => setMessage(""), 3000);
  }

  async function toggleStatus(p: Payout) {
    const newStatus = p.status === "paid" ? "pending" : "paid";
    await fetch(`/api/admin/finance/teacher-payouts/${p._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    loadPayouts();
  }

  async function handleDelete(id: string) {
    if (!confirm("هل تريد حذف هذا المستحق؟")) return;
    await fetch(`/api/admin/finance/teacher-payouts/${id}`, { method: "DELETE" });
    setMessage("تم الحذف");
    loadPayouts();
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      <div className="flex flex-wrap gap-3">
        <select className="input-field" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
          <option value="">كل الأساتذة</option>
          {teachers.map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>
        <select className="input-field" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">كل الدورات</option>
          {courses.map((c) => (
            <option key={c._id} value={c._id}>{c.title}</option>
          ))}
        </select>
        <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="pending">معلق</option>
          <option value="paid">مدفوع</option>
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={loadPayouts}>تطبيق</Button>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setModalOpen(true); }} className="mr-auto">
          <Plus className="h-4 w-4" /> إضافة مستحق
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted">جاري التحميل...</p>
      ) : payouts.length === 0 ? (
        <EmptyState title="لا توجد مستحقات" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-pink-50 text-muted">
              <tr>
                <th className="p-3 text-start">الأستاذ</th>
                <th className="p-3 text-start">الدورة</th>
                <th className="p-3 text-start">المبلغ</th>
                <th className="p-3 text-start">الحالة</th>
                <th className="p-3 text-start">التاريخ</th>
                <th className="p-3 text-start">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p._id} className="border-t border-border">
                  <td className="p-3 font-medium">{p.teacherName}</td>
                  <td className="p-3">{p.courseTitle || "—"}</td>
                  <td className="p-3 font-bold">{formatCurrency(p.amount)}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => toggleStatus(p)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
                    >
                      {p.status === "paid" ? "مدفوع" : "معلق"}
                    </button>
                  </td>
                  <td className="p-3">{formatDate(p.payoutDate)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditingId(p._id); setForm({ teacherId: p.teacherId, courseId: p.courseId || "", numberOfSessions: String(p.numberOfSessions || 0), extraSessions: String(p.extraSessions || 0), sessionRate: String(p.sessionRate || 0), manualAdjustment: String(p.manualAdjustment || 0), totalDue: String(p.totalDue || p.amount), paid: String(p.paid ?? p.amount), amount: String(p.amount), payoutType: p.payoutType, payoutDate: p.payoutDate.slice(0, 10), status: p.status, note: p.note || "" }); setModalOpen(true); }} className="text-primary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(p._id)} className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "تعديل مستحق" : "إضافة مستحق"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="mb-1 block text-sm font-medium">الأستاذ</label>
            <select className="input-field w-full" required value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">اختر أستاذاً</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">الدورة (اختياري)</label>
            <select className="input-field w-full" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">بدون دورة</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="عدد الحصص" type="number" min="0" value={form.numberOfSessions} onChange={(e) => setForm({ ...form, numberOfSessions: e.target.value })} />
            <Input label="حصص إضافية" type="number" min="0" value={form.extraSessions} onChange={(e) => setForm({ ...form, extraSessions: e.target.value })} />
            <Input label="قيمة الحصة" type="number" min="0" value={form.sessionRate} onChange={(e) => setForm({ ...form, sessionRate: e.target.value })} />
            <Input label="تعديل يدوي" type="number" value={form.manualAdjustment} onChange={(e) => setForm({ ...form, manualAdjustment: e.target.value })} />
            <Input label="إجمالي المستحق" type="number" min="0" value={form.totalDue} onChange={(e) => setForm({ ...form, totalDue: e.target.value })} />
            <Input label="المدفوع" type="number" min="0" value={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.value, amount: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">نوع المستحق</label>
              <select className="input-field w-full" value={form.payoutType} onChange={(e) => setForm({ ...form, payoutType: e.target.value })}>
                {PAYOUT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">الحالة</label>
              <select className="input-field w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">معلق</option>
                <option value="paid">مدفوع</option>
              </select>
            </div>
          </div>
          <Input label="تاريخ المستحق" type="date" required value={form.payoutDate} onChange={(e) => setForm({ ...form, payoutDate: e.target.value })} />
          <Input label="ملاحظة" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <Button type="submit" fullWidth>{editingId ? "حفظ" : "إضافة"}</Button>
        </form>
      </Modal>
    </div>
  );
}
