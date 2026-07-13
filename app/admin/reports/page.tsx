"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer, RefreshCw, Search } from "lucide-react";
import Title from "@/components/ui/Title";
import Pagination from "@/components/ui/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import { cn } from "@/lib/utils";

const REPORTS = [
  { key: "students", title: "قائمة الطلاب", category: "students" },
  { key: "active_students", title: "الطلاب النشطون", category: "students" },
  { key: "suspended_students", title: "الطلاب الموقوفون", category: "students" },
  { key: "graduated_students", title: "الطلاب المتخرجون", category: "students" },
  { key: "archived_students", title: "الطلاب المؤرشفون", category: "students" },
  { key: "new_registrations", title: "التسجيلات الجديدة", category: "students" },
  { key: "students_by_level", title: "حسب المستوى", category: "students" },
  { key: "students_by_class", title: "حسب القسم", category: "students" },
  { key: "students_by_guardian", title: "حسب الولي", category: "students" },
  { key: "students_by_municipality", title: "حسب البلدية", category: "students" },
  { key: "students_by_transportation", title: "حسب النقل", category: "students" },
  { key: "medical_students", title: "المعلومات الطبية", category: "students" },
  { key: "outstanding_balances", title: "الأرصدة المستحقة", category: "finance" },
  { key: "teachers", title: "الأساتذة النشطون", category: "teachers" },
  { key: "teacher_attendance", title: "حضور الأساتذة", category: "teachers" },
  { key: "teacher_assignments", title: "التكليفات", category: "teachers" },
  { key: "teacher_salaries", title: "الرواتب", category: "teachers" },
  { key: "teacher_bonuses", title: "المكافآت", category: "teachers" },
  { key: "teacher_deductions", title: "الاقتطاعات", category: "teachers" },
  { key: "teacher_payments", title: "مدفوعات الأساتذة", category: "teachers" },
  { key: "teacher_private_earnings", title: "أرباح الحصص الخاصة", category: "teachers" },
  { key: "finance_income", title: "الدخل المالي", category: "finance" },
  { key: "daily_income", title: "الدخل اليومي", category: "revenue" },
  { key: "weekly_income", title: "الدخل الأسبوعي", category: "revenue" },
  { key: "monthly_income", title: "الدخل الشهري", category: "revenue" },
  { key: "yearly_income", title: "الدخل السنوي", category: "revenue" },
  { key: "registration_fees", title: "رسوم التسجيل", category: "revenue" },
  { key: "tuition_fees", title: "رسوم الدراسة", category: "revenue" },
  { key: "kindergarten_income", title: "دخل الروضة", category: "revenue" },
  { key: "private_lesson_income", title: "دخل الحصص الخاصة", category: "revenue" },
  { key: "transportation_income", title: "دخل النقل", category: "revenue" },
  { key: "other_income", title: "دخل آخر", category: "revenue" },
  { key: "expenses", title: "المصاريف", category: "expenses" },
  { key: "net_profit", title: "صافي الربح", category: "revenue" },
  { key: "debts", title: "الديون", category: "finance" },
  { key: "refunds", title: "الاسترجاعات", category: "finance" },
  { key: "cash_flow", title: "التدفق النقدي", category: "finance" },
  { key: "student_attendance", title: "الحضور اليومي", category: "attendance" },
  { key: "monthly_attendance", title: "الحضور الشهري", category: "attendance" },
  { key: "attendance_summary", title: "نسب الحضور", category: "attendance" },
  { key: "attendance_by_class", title: "حسب القسم", category: "attendance" },
  { key: "attendance_by_teacher", title: "حسب الأستاذ", category: "attendance" },
  { key: "attendance_by_course", title: "حسب الدورة", category: "attendance" },
  { key: "attendance_by_kindergarten", title: "حضور الروضة", category: "attendance" },
  { key: "courses", title: "الدورات", category: "courses" },
  { key: "enrollments", title: "التسجيلات", category: "enrollments" },
  { key: "private_lessons", title: "الحصص الخاصة", category: "private_lessons" },
  { key: "private_lesson_attendance", title: "حضور الحصص الخاصة", category: "private_lessons" },
  { key: "kindergarten", title: "الروضة", category: "kindergarten" },
  { key: "transportation", title: "النقل", category: "transportation" },
  { key: "academic_performance", title: "الأداء الأكاديمي", category: "academic_performance" },
  { key: "payments", title: "المدفوعات", category: "payments" },
  { key: "receipts", title: "الوصولات", category: "receipts" },
  { key: "invoices", title: "الفواتير", category: "invoices" },
  { key: "audit_logs", title: "سجلات التدقيق", category: "audit_logs" },
  { key: "dashboard_analytics", title: "لوحة التحكم", category: "analytics" },
  { key: "rollover_students", title: "الطلاب المرحلون", category: "academic_seasons" },
  { key: "promoted_students", title: "الطلاب المرقون", category: "academic_seasons" },
  { key: "repeating_students", title: "الطلاب المعيدون", category: "academic_seasons" },
  { key: "transferred_students", title: "الطلاب المحولون", category: "academic_seasons" },
  { key: "rollover_graduated_students", title: "خريجو الترحيل", category: "academic_seasons" },
  { key: "rollover_withdrawn_students", title: "منسحبو الترحيل", category: "academic_seasons" },
  { key: "rollover_archived_students", title: "مؤرشفو الترحيل", category: "academic_seasons" },
  { key: "failed_rollover_items", title: "فشل الترحيل", category: "academic_seasons" },
  { key: "rollover_conflicts", title: "تعارضات الترحيل", category: "academic_seasons" },
  { key: "financial_carry_forward", title: "ترحيل الأرصدة", category: "academic_seasons" },
  { key: "transportation_rollover", title: "ترحيل النقل", category: "academic_seasons" },
  { key: "kindergarten_rollover", title: "ترحيل الروضة", category: "academic_seasons" },
  { key: "season_comparison", title: "مقارنة المواسم", category: "academic_seasons" },
] as const;

const CATEGORIES = [
  { key: "students", label: "الطلاب" },
  { key: "teachers", label: "الأساتذة" },
  { key: "finance", label: "المالية" },
  { key: "attendance", label: "الحضور" },
  { key: "courses", label: "الدورات" },
  { key: "enrollments", label: "التسجيلات" },
  { key: "private_lessons", label: "الحصص الخاصة" },
  { key: "kindergarten", label: "الروضة" },
  { key: "transportation", label: "النقل" },
  { key: "academic_performance", label: "الأداء" },
  { key: "payments", label: "المدفوعات" },
  { key: "receipts", label: "الوصولات" },
  { key: "invoices", label: "الفواتير" },
  { key: "expenses", label: "المصاريف" },
  { key: "revenue", label: "الإيرادات" },
  { key: "audit_logs", label: "التدقيق" },
  { key: "analytics", label: "التحليلات" },
  { key: "academic_seasons", label: "المواسم" },
] as const;

interface ReportColumn { key: string; label: string }
interface ReportData {
  key: string;
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary: Record<string, string | number>;
  pagination?: { page: number; limit: number; total: number; totalPages: number; hasPrev: boolean; hasNext: boolean };
  generatedAt?: string;
}

const defaultPagination = { page: 1, limit: 25, total: 0, totalPages: 1, hasPrev: false, hasNext: false };

export default function AdminReportsPage() {
  const [category, setCategory] = useState("students");
  const [reportKey, setReportKey] = useState("students");
  const [report, setReport] = useState<ReportData | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", from: "", to: "", academicSeason: "", academicLevel: "", teacherId: "", courseId: "", className: "", group: "", studentStatus: "", paymentStatus: "", attendanceStatus: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const availableReports = useMemo(() => REPORTS.filter((item) => item.category === category), [category]);
  const selectedReportKey = availableReports.some((item) => item.key === reportKey) ? reportKey : (availableReports[0]?.key ?? "students");

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params;
  }, [filters]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const params = buildParams();
      params.set("page", String(page));
      params.set("limit", "25");
      const res = await fetch(`/api/admin/reports/${selectedReportKey}?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!active) return;
      if (!res.ok) {
        setError(data.error || "تعذر تحميل التقرير");
        setReport(null);
      } else {
        setReport(data.report || null);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [buildParams, selectedReportKey, page, refresh]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function chooseCategory(nextCategory: string) {
    const nextReport = REPORTS.find((item) => item.category === nextCategory)?.key ?? "students";
    setCategory(nextCategory);
    setReportKey(nextReport);
    setPage(1);
  }

  function runSearch() {
    setPage(1);
    setRefresh((value) => value + 1);
  }

  function exportReport(format: "csv" | "excel" | "pdf" | "print") {
    const params = buildParams();
    params.set("export", format);
    window.open(`/api/admin/reports/${selectedReportKey}?${params}`, "_blank", "noopener,noreferrer");
  }

  function cell(row: Record<string, unknown>, key: string) {
    const value = row[key];
    if (typeof value === "number") return value.toLocaleString("ar-DZ");
    return String(value ?? "—");
  }

  return (
    <div dir="rtl">
      <Title title="مركز التقارير والتحليلات" subtitle="Haytham Educational Academy" className="mb-6" />

      <div className="mb-5 flex flex-wrap gap-2">
        {CATEGORIES.map((item) => (
          <button key={item.key} type="button" onClick={() => chooseCategory(item.key)} className={cn("rounded-lg border px-3 py-2 text-sm transition", category === item.key ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-gray-50")}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-[270px_1fr]">
        <aside className="rounded-lg border border-border bg-white p-3">
          <p className="mb-2 text-sm font-semibold">التقارير</p>
          <div className="max-h-[620px] space-y-1 overflow-auto pe-1">
            {availableReports.map((item) => (
              <button key={item.key} type="button" onClick={() => { setReportKey(item.key); setPage(1); }} className={cn("w-full rounded-md px-3 py-2 text-right text-sm transition", selectedReportKey === item.key ? "bg-primary text-white" : "hover:bg-gray-50")}>
                {item.title}
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-4">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <input className="input-field" placeholder="بحث" value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} />
              <input className="input-field" type="date" value={filters.from} onChange={(e) => updateFilter("from", e.target.value)} />
              <input className="input-field" type="date" value={filters.to} onChange={(e) => updateFilter("to", e.target.value)} />
              <input className="input-field" placeholder="الموسم" value={filters.academicSeason} onChange={(e) => updateFilter("academicSeason", e.target.value)} />
              <input className="input-field" placeholder="المستوى" value={filters.academicLevel} onChange={(e) => updateFilter("academicLevel", e.target.value)} />
              <input className="input-field" placeholder="القسم" value={filters.className} onChange={(e) => updateFilter("className", e.target.value)} />
              <input className="input-field" placeholder="الفوج" value={filters.group} onChange={(e) => updateFilter("group", e.target.value)} />
              <input className="input-field" placeholder="معرف الأستاذ" value={filters.teacherId} onChange={(e) => updateFilter("teacherId", e.target.value)} />
              <input className="input-field" placeholder="معرف الدورة" value={filters.courseId} onChange={(e) => updateFilter("courseId", e.target.value)} />
              <select className="input-field" value={filters.studentStatus} onChange={(e) => updateFilter("studentStatus", e.target.value)}>
                <option value="">حالة الطالب</option>
                <option value="active">نشط</option>
                <option value="pending">قيد المعالجة</option>
                <option value="suspended">موقوف</option>
                <option value="withdrawn">منسحب</option>
                <option value="graduated">متخرج</option>
                <option value="archived">مؤرشف</option>
              </select>
              <select className="input-field" value={filters.paymentStatus} onChange={(e) => updateFilter("paymentStatus", e.target.value)}>
                <option value="">حالة الدفع</option>
                <option value="paid">مدفوع</option>
                <option value="partially_paid">مدفوع جزئيا</option>
                <option value="partial">جزئي</option>
                <option value="unpaid">غير مدفوع</option>
                <option value="pending">قيد الانتظار</option>
                <option value="overdue">متأخر</option>
                <option value="completed">مكتمل</option>
              </select>
              <select className="input-field" value={filters.attendanceStatus} onChange={(e) => updateFilter("attendanceStatus", e.target.value)}>
                <option value="">حالة الحضور</option>
                <option value="present">حاضر</option>
                <option value="absent">غائب</option>
                <option value="late">متأخر</option>
                <option value="excused">مبرر</option>
                <option value="left_early">غادر مبكرا</option>
              </select>
              <button type="button" onClick={runSearch} className="btn-primary justify-center"><Search className="h-4 w-4" /> تطبيق</button>
            </div>
          </div>

          {error && <ApiErrorAlert error={error} />}

          <div className="rounded-lg border border-border bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">{report?.title ?? "التقرير"}</h2>
                {report?.generatedAt && <p className="text-sm text-muted">{new Date(report.generatedAt).toLocaleString("ar-DZ")}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={runSearch} className="rounded-md border border-border px-3 py-2 text-sm"><RefreshCw className="inline h-4 w-4" /> تحديث</button>
                <button type="button" onClick={() => exportReport("csv")} className="rounded-md border border-border px-3 py-2 text-sm"><Download className="inline h-4 w-4" /> CSV</button>
                <button type="button" onClick={() => exportReport("excel")} className="rounded-md border border-border px-3 py-2 text-sm"><FileSpreadsheet className="inline h-4 w-4" /> Excel</button>
                <button type="button" onClick={() => exportReport("pdf")} className="rounded-md border border-border px-3 py-2 text-sm"><FileText className="inline h-4 w-4" /> PDF</button>
                <button type="button" onClick={() => exportReport("print")} className="rounded-md border border-border px-3 py-2 text-sm"><Printer className="inline h-4 w-4" /> طباعة</button>
              </div>
            </div>

            {report?.summary && (
              <div className="mb-4 grid gap-3 md:grid-cols-4">
                {Object.entries(report.summary).map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted">{key}</p>
                    <p className="mt-1 text-lg font-bold">{typeof value === "number" ? value.toLocaleString("ar-DZ") : value}</p>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <p className="py-10 text-center text-muted">جاري تحميل التقرير...</p>
            ) : report && report.rows.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gray-50">
                        {report.columns.map((column) => <th key={column.key} className="p-3 text-right font-semibold">{column.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row, index) => (
                        <tr key={index} className="border-b border-border">
                          {report.columns.map((column) => <td key={column.key} className="p-3 align-top">{cell(row, column.key)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination {...(report.pagination ?? defaultPagination)} onPageChange={setPage} />
              </>
            ) : (
              <EmptyState title="لا توجد بيانات" description="غيّر الفلاتر أو اختر تقريرا آخر." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
