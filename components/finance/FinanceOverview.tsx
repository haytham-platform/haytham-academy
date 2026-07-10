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
  outstandingTeacherBalances: number;
  outstandingStudentBalances: number;
  netProfit: number;
  paymentCount: number;
}

interface Summary {
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  year: PeriodStats;
  totalPayments: number;
  cashbox: {
    openingBalance: number;
    currentBalance: number;
    openingToday: number;
    todayIn: number;
    todayOut: number;
    expectedCash: number;
    actualCash: number | null;
    difference: number | null;
    closure: {
      _id: string;
      actualCash: number;
      expectedCash: number;
      difference: number;
      status: string;
      approvalStatus: string;
      note: string;
      updatedAt: string;
    } | null;
  };
  recentPayments: Array<{
    _id: string;
    receiptNumber?: string;
    studentName?: string;
    courseTitle?: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
  }>;
  recentExpenses: Array<{
    _id: string;
    expenseNumber?: string;
    title: string;
    amount: number;
    category: string;
    expenseDate: string;
  }>;
  recentPayouts: Array<{
    _id: string;
    teacherName?: string;
    amount: number;
    remaining: number;
    status: string;
    payoutDate: string;
  }>;
}

const periods: Array<{ key: keyof Pick<Summary, "today" | "week" | "month" | "year">; title: string }> = [
  { key: "today", title: "اليوم" },
  { key: "week", title: "هذا الأسبوع" },
  { key: "month", title: "هذا الشهر" },
  { key: "year", title: "هذه السنة" },
];

export default function FinanceOverview() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/finance/summary", { cache: "no-store" })
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
      {periods.map((period) => {
        const data = summary[period.key];
        return (
          <section key={period.key}>
            <h3 className="mb-4 text-lg font-bold">{period.title}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard title="الدخل" value={data.income} variant="success" />
              <StatCard title="المصاريف" value={data.expenses} variant="danger" />
              <StatCard title="الأرباح" value={data.netProfit} variant="primary" />
              <StatCard title="مدفوعات الأساتذة" value={data.paidTeacherPayouts} />
              <StatCard title="مستحقات الطلاب" value={data.outstandingStudentBalances} />
              <StatCard title="باقي الأساتذة" value={data.outstandingTeacherBalances} />
            </div>
          </section>
        );
      })}

      <section>
        <h3 className="mb-4 text-lg font-bold">الصندوق اليومي</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard title="الرصيد الافتتاحي" value={summary.cashbox.openingToday} />
          <StatCard title="دخل الصندوق" value={summary.cashbox.todayIn} variant="success" />
          <StatCard title="خروج الصندوق" value={summary.cashbox.todayOut} variant="danger" />
          <StatCard title="الرصيد المتوقع" value={summary.cashbox.expectedCash} variant="primary" />
          {summary.cashbox.closure ? (
            <>
              <StatCard title="النقد الفعلي" value={summary.cashbox.actualCash ?? 0} variant="success" />
              <StatCard
                title="الفرق"
                value={summary.cashbox.difference ?? 0}
                variant={(summary.cashbox.difference ?? 0) === 0 ? "success" : "danger"}
              />
            </>
          ) : (
            <Card className="!p-4 sm:col-span-2">
              <p className="text-sm text-muted">الإغلاق اليومي</p>
              <p className="mt-1 text-sm font-medium">لا يوجد إغلاق نقدي لهذا اليوم</p>
            </Card>
          )}
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
                    <p className="text-xs text-muted">{p.receiptNumber || p.courseTitle}</p>
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
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted">{e.expenseNumber}</p>
                  </div>
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
                      {p.status === "paid" ? "مدفوع" : `متبقي ${formatCurrency(p.remaining || 0)}`}
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
