"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "./StatCard";
import { Input } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/finance-labels";

interface CashboxData {
  currentBalance: number;
  openingToday: number;
  todayIn: number;
  todayOut: number;
  netToday: number;
  expectedCashToday: number;
  currency: string;
  closure?: {
    _id: string;
    actualCash: number;
    expectedCash: number;
    difference: number;
    status: string;
    approvalStatus: string;
    note?: string;
  } | null;
}

interface LedgerEntry {
  _id: string;
  type: string;
  amount: number;
  direction: string;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  income: "دخل",
  expense: "مصروف",
  teacher_payout: "مستحق أستاذ",
  adjustment: "تعديل",
};

export default function CashboxTab() {
  const [cashbox, setCashbox] = useState<CashboxData | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({ amount: "", direction: "in", reason: "" });
  const [closeForm, setCloseForm] = useState({ actualCash: "", note: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const [boxRes, ledgerRes] = await Promise.all([
      fetch("/api/admin/finance/cashbox"),
      fetch(`/api/admin/finance/cash-ledger?${params}`),
    ]);
    const boxData = await boxRes.json();
    const ledgerData = await ledgerRes.json();
    setCashbox(boxData.cashbox || null);
    setEntries(ledgerData.entries || []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const [boxRes, ledgerRes] = await Promise.all([
        fetch("/api/admin/finance/cashbox"),
        fetch(`/api/admin/finance/cash-ledger?${params}`),
      ]);
      const boxData = await boxRes.json();
      const ledgerData = await ledgerRes.json();
      if (active) {
        setCashbox(boxData.cashbox || null);
        setEntries(ledgerData.entries || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [typeFilter, from, to]);

  async function handleAdjustment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/finance/cashbox/adjustment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(adjForm.amount),
        direction: adjForm.direction,
        reason: adjForm.reason,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setMessage("تم تسجيل التعديل");
    setModalOpen(false);
    setAdjForm({ amount: "", direction: "in", reason: "" });
    loadData();
    setTimeout(() => setMessage(""), 3000);
  }

  async function handleCloseCash(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/finance/cashbox/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actualCash: Number(closeForm.actualCash),
        note: closeForm.note,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return;
    }
    setMessage("تم إغلاق صندوق اليوم");
    setCloseModalOpen(false);
    setCloseForm({ actualCash: "", note: "" });
    loadData();
    setTimeout(() => setMessage(""), 3000);
  }

  if (loading && !cashbox) {
    return <p className="py-12 text-center text-muted">جاري التحميل...</p>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="الرصيد الحالي"
          value={cashbox?.currentBalance ?? 0}
          variant="primary"
          subtitle={cashbox?.currency}
        />
        <StatCard title="رصيد بداية اليوم" value={cashbox?.openingToday ?? 0} />
        <StatCard title="صافي اليوم" value={cashbox?.netToday ?? 0} variant="success" />
        <StatCard title="دخل اليوم" value={cashbox?.todayIn ?? 0} variant="success" />
        <StatCard title="خرج اليوم" value={cashbox?.todayOut ?? 0} variant="danger" />
        <StatCard title="المتوقع اليوم" value={cashbox?.expectedCashToday ?? 0} />
        <StatCard
          title="النقد الفعلي"
          value={cashbox?.closure?.actualCash ?? 0}
          subtitle={cashbox?.closure ? `${cashbox.closure.status} / ${cashbox.closure.approvalStatus}` : "لم يغلق"}
        />
        <StatCard
          title="فرق الصندوق"
          value={cashbox?.closure?.difference ?? 0}
          variant={cashbox?.closure?.difference === 0 ? "success" : "danger"}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="input-field"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={loadData}>تطبيق</Button>
        <Button onClick={() => setCloseModalOpen(true)} variant="outline">إغلاق صندوق اليوم</Button>
        <Button onClick={() => setModalOpen(true)} className="mr-auto">
          <Plus className="h-4 w-4" /> تعديل يدوي
        </Button>
      </div>

      <Card>
        <h4 className="mb-4 font-bold">سجل الحركات</h4>
        {entries.length === 0 ? (
          <EmptyState title="لا توجد حركات" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-pink-50 text-muted">
                <tr>
                  <th className="p-3 text-start">التاريخ</th>
                  <th className="p-3 text-start">النوع</th>
                  <th className="p-3 text-start">الوصف</th>
                  <th className="p-3 text-start">المبلغ</th>
                  <th className="p-3 text-start">قبل</th>
                  <th className="p-3 text-start">بعد</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e._id} className="border-t border-border">
                    <td className="p-3">{formatDate(e.createdAt)}</td>
                    <td className="p-3">{TYPE_LABELS[e.type] ?? e.type}</td>
                    <td className="p-3">{e.description}</td>
                    <td
                      className={`p-3 font-bold ${e.direction === "in" ? "text-green-600" : "text-red-600"}`}
                    >
                      {e.direction === "in" ? "+" : "-"}
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="p-3">{formatCurrency(e.balanceBefore)}</td>
                    <td className="p-3 font-medium">{formatCurrency(e.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="تعديل يدوي للصندوق">
        <form onSubmit={handleAdjustment} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          <Input
            label="المبلغ (د.ج)"
            type="number"
            min="1"
            required
            value={adjForm.amount}
            onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-sm font-medium">الاتجاه</label>
            <select
              className="input-field w-full"
              value={adjForm.direction}
              onChange={(e) => setAdjForm({ ...adjForm, direction: e.target.value })}
            >
              <option value="in">إيداع (+)</option>
              <option value="out">سحب (-)</option>
            </select>
          </div>
          <Input
            label="السبب (إلزامي)"
            required
            value={adjForm.reason}
            onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
          />
          <Button type="submit" fullWidth>تسجيل التعديل</Button>
        </form>
      </Modal>

      <Modal open={closeModalOpen} onClose={() => setCloseModalOpen(false)} title="إغلاق صندوق اليوم">
        <form onSubmit={handleCloseCash} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          <div className="rounded-xl border border-border p-3 text-sm">
            <p className="text-muted">النقد المتوقع اليوم</p>
            <p className="text-xl font-bold">{formatCurrency(cashbox?.expectedCashToday ?? 0)}</p>
          </div>
          <Input
            label="النقد الفعلي اليوم"
            type="number"
            min="0"
            required
            value={closeForm.actualCash}
            onChange={(e) => setCloseForm({ ...closeForm, actualCash: e.target.value })}
          />
          <Input
            label="ملاحظات"
            value={closeForm.note}
            onChange={(e) => setCloseForm({ ...closeForm, note: e.target.value })}
          />
          <Button type="submit" fullWidth>إغلاق الصندوق</Button>
        </form>
      </Modal>
    </div>
  );
}
