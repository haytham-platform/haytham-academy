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
  labelOf,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
} from "@/lib/finance-labels";

interface Payment {
  _id: string;
  studentId: string;
  studentName?: string;
  studentPhone?: string;
  courseId: string;
  courseTitle?: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  type: string;
  note?: string;
}

interface Option {
  _id: string;
  name?: string;
  title?: string;
  phone?: string;
}

const emptyForm = {
  studentId: "",
  courseId: "",
  amount: "",
  paymentMethod: "cash",
  paymentDate: new Date().toISOString().slice(0, 10),
  type: "course_fee",
  note: "",
};

export default function PaymentsTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPayments() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (courseFilter) params.set("courseId", courseFilter);
    if (methodFilter) params.set("paymentMethod", methodFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/admin/finance/payments?${params}`);
    const data = await res.json();
    setPayments(data.payments || []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (courseFilter) params.set("courseId", courseFilter);
      if (methodFilter) params.set("paymentMethod", methodFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const [payRes, sRes, cRes] = await Promise.all([
        fetch(`/api/admin/finance/payments?${params}`),
        fetch("/api/admin/students"),
        fetch("/api/admin/courses"),
      ]);
      const payData = await payRes.json();
      const sData = await sRes.json();
      const cData = await cRes.json();
      if (active) {
        setPayments(payData.payments || []);
        setStudents(sData.students || []);
        setCourses(cData.courses || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [search, courseFilter, methodFilter, from, to]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
    setError("");
  }

  function openEdit(p: Payment) {
    setEditingId(p._id);
    setForm({
      studentId: p.studentId,
      courseId: p.courseId,
      amount: String(p.amount),
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate.slice(0, 10),
      type: p.type,
      note: p.note || "",
    });
    setModalOpen(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = { ...form, amount: Number(form.amount) };
    const url = editingId
      ? `/api/admin/finance/payments/${editingId}`
      : "/api/admin/finance/payments";
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
    setMessage(editingId ? "تم تحديث الدفعة" : "تمت إضافة الدفعة");
    setModalOpen(false);
    loadPayments();
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm("هل تريد حذف هذه الدفعة؟")) return;
    const res = await fetch(`/api/admin/finance/payments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMessage("تم حذف الدفعة");
      loadPayments();
      setTimeout(() => setMessage(""), 3000);
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="بحث بالاسم أو الهاتف"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[180px]"
        />
        <select
          className="input-field min-w-[140px]"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
        >
          <option value="">كل الدورات</option>
          {courses.map((c) => (
            <option key={c._id} value={c._id}>{c.title}</option>
          ))}
        </select>
        <select
          className="input-field min-w-[140px]"
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
        >
          <option value="">كل طرق الدفع</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={loadPayments}>تطبيق</Button>
        <Button onClick={openCreate} className="mr-auto">
          <Plus className="h-4 w-4" /> إضافة دفعة
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted">جاري التحميل...</p>
      ) : payments.length === 0 ? (
        <EmptyState title="لا توجد مدفوعات" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-pink-50 text-muted">
              <tr>
                <th className="p-3 text-start">الطالب</th>
                <th className="p-3 text-start">الدورة</th>
                <th className="p-3 text-start">المبلغ</th>
                <th className="p-3 text-start">الطريقة</th>
                <th className="p-3 text-start">التاريخ</th>
                <th className="p-3 text-start">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id} className="border-t border-border">
                  <td className="p-3">
                    <p className="font-medium">{p.studentName}</p>
                    <p className="text-xs text-muted">{p.studentPhone}</p>
                  </td>
                  <td className="p-3">{p.courseTitle}</td>
                  <td className="p-3 font-bold text-primary">{formatCurrency(p.amount)}</td>
                  <td className="p-3">{labelOf(PAYMENT_METHODS, p.paymentMethod)}</td>
                  <td className="p-3">{formatDate(p.paymentDate)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(p)} className="text-primary">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "تعديل دفعة" : "إضافة دفعة"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="mb-1 block text-sm font-medium">الطالب</label>
            <select
              className="input-field w-full"
              required
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            >
              <option value="">اختر طالباً</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>{s.name} — {s.phone}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">الدورة</label>
            <select
              className="input-field w-full"
              required
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
            >
              <option value="">اختر دورة</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>{c.title}</option>
              ))}
            </select>
          </div>
          <Input label="المبلغ (د.ج)" type="number" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">طريقة الدفع</label>
              <select className="input-field w-full" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">النوع</label>
              <select className="input-field w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {PAYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <Input label="تاريخ الدفع" type="date" required value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
          <Input label="ملاحظة" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <Button type="submit" fullWidth>{editingId ? "حفظ التعديل" : "إضافة"}</Button>
        </form>
      </Modal>
    </div>
  );
}
