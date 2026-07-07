"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatCurrency, formatDate, PAYMENT_METHODS } from "@/lib/finance-labels";

interface Report {
  type: string;
  from: string;
  to: string;
  totalIncome: number;
  totalExpenses: number;
  paidTeacherPayouts: number;
  pendingTeacherPayouts: number;
  netProfit: number;
  operationCount: number;
  paymentCount: number;
  expenseCount: number;
  payoutCount: number;
}

const REPORT_TYPES = [
  { value: "daily", label: "تقرير يومي" },
  { value: "monthly", label: "تقرير شهري" },
  { value: "yearly", label: "تقرير سنوي" },
  { value: "course", label: "حسب دورة" },
  { value: "teacher", label: "حسب أستاذ" },
  { value: "paymentMethod", label: "حسب طريقة الدفع" },
];

export default function ReportsTab() {
  const [type, setType] = useState("monthly");
  const [courseId, setCourseId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [courses, setCourses] = useState<{ _id: string; title: string }[]>([]);
  const [teachers, setTeachers] = useState<{ _id: string; name: string }[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/courses").then((r) => r.json()),
      fetch("/api/admin/teachers").then((r) => r.json()),
    ]).then(([c, t]) => {
      setCourses(c.courses || []);
      setTeachers(t.teachers || []);
    });
  }, []);

  async function generateReport() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ type });
    if (courseId) params.set("courseId", courseId);
    if (teacherId) params.set("teacherId", teacherId);
    if (paymentMethod) params.set("paymentMethod", paymentMethod);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const res = await fetch(`/api/admin/finance/reports?${params}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "فشل إنشاء التقرير");
      return;
    }
    setReport(data.report);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select className="input-field" value={type} onChange={(e) => setType(e.target.value)}>
          {REPORT_TYPES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {(type === "course" || courseId) && (
          <select className="input-field" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">اختر دورة</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>{c.title}</option>
            ))}
          </select>
        )}
        {(type === "teacher" || teacherId) && (
          <select className="input-field" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">اختر أستاذاً</option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
        )}
        {(type === "paymentMethod" || paymentMethod) && (
          <select className="input-field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">طريقة الدفع</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        )}
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={generateReport} loading={loading}>إنشاء التقرير</Button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {report && (
        <Card>
          <h4 className="mb-4 text-lg font-bold">
            {REPORT_TYPES.find((r) => r.value === report.type)?.label}
          </h4>
          <p className="mb-4 text-sm text-muted">
            من {formatDate(report.from)} إلى {formatDate(report.to)}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted">إجمالي الدخل</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(report.totalIncome)}</p>
            </div>
            <div>
              <p className="text-sm text-muted">إجمالي المصاريف</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(report.totalExpenses)}</p>
            </div>
            <div>
              <p className="text-sm text-muted">مستحقات مدفوعة</p>
              <p className="text-xl font-bold">{formatCurrency(report.paidTeacherPayouts)}</p>
            </div>
            <div>
              <p className="text-sm text-muted">مستحقات معلقة</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(report.pendingTeacherPayouts)}</p>
            </div>
            <div>
              <p className="text-sm text-muted">صافي الربح</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(report.netProfit)}</p>
            </div>
            <div>
              <p className="text-sm text-muted">عدد العمليات</p>
              <p className="text-xl font-bold">{report.operationCount}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
