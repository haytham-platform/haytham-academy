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
  EXPENSE_CATEGORIES,
} from "@/lib/finance-labels";

interface Expense {
  _id: string;
  title: string;
  amount: number;
  category: string;
  expenseDate: string;
  note?: string;
}

const emptyForm = {
  title: "",
  amount: "",
  category: "other",
  expenseDate: new Date().toISOString().slice(0, 10),
  note: "",
};

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadExpenses() {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter) params.set("category", categoryFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/admin/finance/expenses?${params}`);
    const data = await res.json();
    setExpenses(data.expenses || []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("category", categoryFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/finance/expenses?${params}`);
      const data = await res.json();
      if (active) {
        setExpenses(data.expenses || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [categoryFilter, from, to]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = { ...form, amount: Number(form.amount) };
    const url = editingId
      ? `/api/admin/finance/expenses/${editingId}`
      : "/api/admin/finance/expenses";
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
    setMessage(editingId ? "تم تحديث المصروف" : "تمت إضافة المصروف");
    setModalOpen(false);
    loadExpenses();
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm("هل تريد حذف هذا المصروف؟")) return;
    await fetch(`/api/admin/finance/expenses/${id}`, { method: "DELETE" });
    setMessage("تم حذف المصروف");
    loadExpenses();
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      <div className="flex flex-wrap gap-3">
        <select className="input-field" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">كل التصنيفات</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={loadExpenses}>تطبيق</Button>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setModalOpen(true); }} className="mr-auto">
          <Plus className="h-4 w-4" /> إضافة مصروف
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted">جاري التحميل...</p>
      ) : expenses.length === 0 ? (
        <EmptyState title="لا توجد مصاريف" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-pink-50 text-muted">
              <tr>
                <th className="p-3 text-start">العنوان</th>
                <th className="p-3 text-start">التصنيف</th>
                <th className="p-3 text-start">المبلغ</th>
                <th className="p-3 text-start">التاريخ</th>
                <th className="p-3 text-start">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e._id} className="border-t border-border">
                  <td className="p-3 font-medium">{e.title}</td>
                  <td className="p-3">{labelOf(EXPENSE_CATEGORIES, e.category)}</td>
                  <td className="p-3 font-bold text-red-600">{formatCurrency(e.amount)}</td>
                  <td className="p-3">{formatDate(e.expenseDate)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditingId(e._id); setForm({ title: e.title, amount: String(e.amount), category: e.category, expenseDate: e.expenseDate.slice(0, 10), note: e.note || "" }); setModalOpen(true); }} className="text-primary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(e._id)} className="text-red-600">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "تعديل مصروف" : "إضافة مصروف"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <Input label="العنوان" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input label="المبلغ (د.ج)" type="number" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <div>
            <label className="mb-1 block text-sm font-medium">التصنيف</label>
            <select className="input-field w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <Input label="تاريخ المصروف" type="date" required value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
          <Input label="ملاحظة" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <Button type="submit" fullWidth>{editingId ? "حفظ" : "إضافة"}</Button>
        </form>
      </Modal>
    </div>
  );
}
