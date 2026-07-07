"use client";

import { useEffect, useState } from "react";
import {
  formatCurrency,
  labelOf,
  LESSON_PAYMENT_STATUSES,
} from "@/lib/finance-labels";
import EmptyState from "@/components/ui/EmptyState";

interface TeacherOption {
  _id: string;
  name: string;
  subject: string;
}

interface TeacherAccount {
  teacher: {
    _id: string;
    name: string;
    subject: string;
    adminShare: number;
    teacherShare: number;
  };
  sessionCounts: {
    one: number;
    two: number;
    three: number;
    four: number;
  };
  totalStudents: number;
  totalRevenue: number;
  adminShareAmount: number;
  teacherShareAmount: number;
  invoices: {
    _id: string;
    studentName?: string;
    sessionCount: number;
    totalAmount: number;
    paymentStatus: string;
    invoiceDate: string;
  }[];
  month: string | null;
}

export default function TeacherAccountTab() {
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [month, setMonth] = useState("");
  const [account, setAccount] = useState<TeacherAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/teachers?limit=500")
      .then((r) => r.json())
      .then((d) => setTeachers(d.teachers || []));
  }, []);

  useEffect(() => {
    if (!teacherId) return;

    let active = true;

    (async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({ teacherId });
      if (month) params.set("month", month);

      try {
        const res = await fetch(`/api/admin/finance/teacher-account?${params}`);
        const d = await res.json();
        if (!active) return;
        if (d.error) {
          setError(d.error as string);
          setAccount(null);
        } else {
          // Temporary debug — verify teacherId linkage in browser console
          console.log("[TeacherAccountTab]", {
            selectedTeacherId: teacherId,
            invoicesCount: (d.invoices as unknown[] | undefined)?.length ?? 0,
            totalRevenue: d.totalRevenue,
            totalStudents: d.totalStudents,
          });
          setAccount(d as TeacherAccount);
        }
      } catch {
        if (active) {
          setError("حدث خطأ أثناء جلب البيانات");
          setAccount(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [teacherId, month]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">حساب الأستاذ</h2>
        <p className="text-sm text-muted">حساب المداخيل وحصة الإدارة والأستاذ من الفواتير المسجلة</p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">الأستاذ</label>
          <select className="input-field" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— اختر الأستاذ —</option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>{t.name} — {t.subject}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">الشهر (اختياري)</label>
          <input type="month" className="input-field" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!teacherId ? (
        <EmptyState title="اختر أستاذاً" description="حدد الأستاذ لعرض حسابه المالي" />
      ) : loading ? (
        <p className="text-muted">جاري الحساب...</p>
      ) : account ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="اسم الأستاذ" value={account.teacher.name} />
            <StatCard label="المادة" value={account.teacher.subject} />
            <StatCard label="نسبة الإدارة" value={`${account.teacher.adminShare}%`} />
            <StatCard label="نسبة الأستاذ" value={`${account.teacher.teacherShare}%`} />
          </div>

          <div className="rounded-2xl border border-border p-4">
            <h3 className="mb-3 font-bold">توزيع التلاميذ حسب عدد الحصص</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="حصة واحدة" value={String(account.sessionCounts.one)} small />
              <StatCard label="حصتان" value={String(account.sessionCounts.two)} small />
              <StatCard label="3 حصص" value={String(account.sessionCounts.three)} small />
              <StatCard label="4 حصص" value={String(account.sessionCounts.four)} small />
              <StatCard label="مجموع التلاميذ" value={String(account.totalStudents)} small highlight />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="مجموع المداخيل" value={formatCurrency(account.totalRevenue)} highlight />
            <StatCard label="حصة الإدارة" value={formatCurrency(account.adminShareAmount)} />
            <StatCard label="حصة الأستاذ" value={formatCurrency(account.teacherShareAmount)} />
          </div>

          {account.invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-bold">تفاصيل الفواتير{account.month ? ` — ${account.month}` : ""}</h3>
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-border text-right">
                    <th className="p-3">الطالب</th>
                    <th className="p-3">الحصص</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {account.invoices.map((inv) => (
                    <tr key={inv._id} className="border-b border-border">
                      <td className="p-3">{inv.studentName}</td>
                      <td className="p-3">{inv.sessionCount}</td>
                      <td className="p-3">{formatCurrency(inv.totalAmount)}</td>
                      <td className="p-3">{labelOf(LESSON_PAYMENT_STATUSES, inv.paymentStatus)}</td>
                      <td className="p-3">{new Date(inv.invoiceDate).toLocaleDateString("ar-DZ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="لا توجد فواتير" description="لا توجد فواتير مسجلة لهذا الأستاذ في الفترة المحددة" />
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  small,
  highlight,
}: {
  label: string;
  value: string;
  small?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-border p-4 ${highlight ? "bg-primary/5" : "bg-white"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-bold ${small ? "text-lg" : "text-xl"}`}>{value}</p>
    </div>
  );
}
