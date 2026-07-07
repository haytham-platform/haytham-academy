"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import StatCard from "./StatCard";
import { formatCurrency, formatDate } from "@/lib/finance-labels";

interface PeriodStats {
  income: number;
  expenses: number;
  paidTeacherPayouts: number;
  netProfit: number;
  paymentCount: number;
}

interface Summary {
  today: PeriodStats;
  month: PeriodStats;
  year: PeriodStats;
  totalPayments: number;
  recentPayments: Array<{
    _id: string;
    studentName?: string;
    courseTitle?: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
  }>;
  recentExpenses: Array<{
    _id: string;
    title: string;
    amount: number;
    category: string;
    expenseDate: string;
  }>;
  recentPayouts: Array<{
    _id: string;
    teacherName?: string;
    amount: number;
    status: string;
    payoutDate: string;
  }>;
}

export default function FinanceOverview() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/finance/summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setSummary(d.summary);
      })
      .catch(() => setError("فشل تحميل الملخص المالي"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-muted">جاري التحميل...</div>;
  }

  if (error || !summary) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">
        {error || "لا توجد بيانات"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-4 text-lg font-bold">اليوم</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="دخل اليوم" value={summary.today.income} variant="success" />
          <StatCard title="مصاريف اليوم" value={summary.today.expenses} variant="danger" />
          <StatCard title="مستحقات مدفوعة" value={summary.today.paidTeacherPayouts} />
          <StatCard title="أرباح اليوم" value={summary.today.netProfit} variant="primary" />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-lg font-bold">هذا الشهر</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="دخل الشهر" value={summary.month.income} variant="success" />
          <StatCard title="مصاريف الشهر" value={summary.month.expenses} variant="danger" />
          <StatCard title="مستحقات مدفوعة" value={summary.month.paidTeacherPayouts} />
          <StatCard title="أرباح الشهر" value={summary.month.netProfit} variant="primary" />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-lg font-bold">هذه السنة</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="دخل السنة" value={summary.year.income} variant="success" />
          <StatCard title="مصاريف السنة" value={summary.year.expenses} variant="danger" />
          <StatCard title="مستحقات مدفوعة" value={summary.year.paidTeacherPayouts} />
          <StatCard title="أرباح السنة" value={summary.year.netProfit} variant="primary" />
        </div>
      </section>

      <Card>
        <p className="text-sm text-muted">إجمالي عدد المدفوعات</p>
        <p className="text-3xl font-bold text-primary">{summary.totalPayments}</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h4 className="mb-4 font-bold">آخر المدفوعات</h4>
          {summary.recentPayments.length === 0 ? (
            <EmptyState title="لا توجد مدفوعات" />
          ) : (
            <ul className="space-y-3 text-sm">
              {summary.recentPayments.map((p) => (
                <li key={p._id} className="flex justify-between gap-2 border-b border-border pb-2">
                  <div>
                    <p className="font-medium">{p.studentName}</p>
                    <p className="text-xs text-muted">{p.courseTitle}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-bold text-primary">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-muted">{formatDate(p.paymentDate)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h4 className="mb-4 font-bold">آخر المصاريف</h4>
          {summary.recentExpenses.length === 0 ? (
            <EmptyState title="لا توجد مصاريف" />
          ) : (
            <ul className="space-y-3 text-sm">
              {summary.recentExpenses.map((e) => (
                <li key={e._id} className="flex justify-between gap-2 border-b border-border pb-2">
                  <p className="font-medium">{e.title}</p>
                  <div className="text-end">
                    <p className="font-bold text-red-600">{formatCurrency(e.amount)}</p>
                    <p className="text-xs text-muted">{formatDate(e.expenseDate)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h4 className="mb-4 font-bold">آخر مستحقات الأساتذة</h4>
          {summary.recentPayouts.length === 0 ? (
            <EmptyState title="لا توجد مستحقات" />
          ) : (
            <ul className="space-y-3 text-sm">
              {summary.recentPayouts.map((p) => (
                <li key={p._id} className="flex justify-between gap-2 border-b border-border pb-2">
                  <div>
                    <p className="font-medium">{p.teacherName}</p>
                    <p className="text-xs text-muted">
                      {p.status === "paid" ? "مدفوع" : "معلق"}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-bold">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-muted">{formatDate(p.payoutDate)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
