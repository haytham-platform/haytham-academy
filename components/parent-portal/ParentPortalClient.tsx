"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Bus, CalendarCheck, Download, FileText, GraduationCap, Printer, ReceiptText, RefreshCw, Users } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/finance-labels";
import { cn } from "@/lib/utils";

type Mode =
  | "dashboard"
  | "children"
  | "attendance"
  | "performance"
  | "finance"
  | "private-lessons"
  | "kindergarten"
  | "transportation"
  | "documents"
  | "communications"
  | "reports";

type Plain = Record<string, unknown>;

const endpoints: Record<Mode, string> = {
  dashboard: "/api/parent/dashboard",
  children: "/api/parent/children",
  attendance: "/api/parent/attendance",
  performance: "/api/parent/performance",
  finance: "/api/parent/finance",
  "private-lessons": "/api/parent/private-lessons",
  kindergarten: "/api/parent/kindergarten",
  transportation: "/api/parent/transportation",
  documents: "/api/parent/documents",
  communications: "/api/parent/communications",
  reports: "/api/parent/reports",
};

const titles: Record<Mode, { title: string; description: string; icon: typeof Users }> = {
  dashboard: { title: "لوحة ولي الأمر", description: "ملخص حي للحضور، الأداء، المالية، والتنبيهات.", icon: Users },
  children: { title: "أبنائي", description: "الطلاب المرتبطون بحساب ولي الأمر فقط.", icon: Users },
  attendance: { title: "الحضور", description: "سجل الحضور اليومي والشهري ونسب الالتزام.", icon: CalendarCheck },
  performance: { title: "الأداء الدراسي", description: "الدرجات، الواجبات، الامتحانات وملاحظات الأساتذة.", icon: GraduationCap },
  finance: { title: "المالية", description: "الرسوم، المدفوعات، الفواتير، الإيصالات، والمتبقي.", icon: ReceiptText },
  "private-lessons": { title: "الحصص الخاصة", description: "جدول الحصص الخاصة، الحضور، والدفع.", icon: GraduationCap },
  kindergarten: { title: "الروضة", description: "اشتراكات الروضة والمدفوعات والحالة.", icon: Users },
  transportation: { title: "النقل", description: "الحافلة، المسار، نقاط الصعود والنزول.", icon: Bus },
  documents: { title: "الوثائق", description: "وثائق التسجيل والملفات الطبية والشهادات المتاحة.", icon: FileText },
  communications: { title: "التواصل", description: "الرسائل، الإعلانات، الملاحظات، والتنبيهات.", icon: Bell },
  reports: { title: "التقارير", description: "تقارير الحضور والمالية والأداء قابلة للطباعة.", icon: FileText },
};

function asRecord(value: unknown): Plain {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Plain) : {};
}

function asArray(value: unknown): Plain[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function text(value: unknown, fallback = "-") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function money(value: unknown) {
  return formatCurrency(Number(value || 0));
}

function date(value: unknown) {
  return value ? formatDate(String(value)) : "-";
}

function statusClass(value: unknown) {
  const status = String(value ?? "");
  if (["present", "paid", "active", "success", "delivered"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (["absent", "failed", "overdue", "suspended"].includes(status)) return "bg-red-50 text-red-700";
  if (["late", "partially_paid", "pending", "scheduled"].includes(status)) return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted">
      {label}
    </div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: unknown; tone?: "default" | "primary" | "danger" }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-white p-4 shadow-sm", tone === "primary" && "border-primary/30 bg-pink-50", tone === "danger" && "border-red-100 bg-red-50")}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{text(value, "0")}</p>
    </div>
  );
}

function Badge({ value }: { value: unknown }) {
  return <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-semibold", statusClass(value))}>{text(value)}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <EmptyState label="لا توجد بيانات مطابقة حاليا." />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-gray-50 text-muted">
          <tr>{columns.map((column) => <th key={column} className="p-3 text-right font-semibold">{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="p-3 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardView({ data }: { data: Plain }) {
  const cards = asRecord(data.cards);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="الأبناء المرتبطون" value={cards.linkedChildren} tone="primary" />
        <StatCard label="حضور اليوم" value={cards.attendanceToday} />
        <StatCard label="نسبة الحضور" value={`${text(cards.attendancePercentage, "0")}%`} />
        <StatCard label="الرصيد المتبقي" value={money(cards.outstandingBalance)} tone="danger" />
        <StatCard label="الحصص القادمة" value={cards.upcomingClasses} />
        <StatCard label="امتحانات حديثة" value={cards.upcomingExams} />
        <StatCard label="درجات حديثة" value={cards.recentGrades} />
        <StatCard label="تنبيهات حديثة" value={cards.recentNotifications} />
      </div>
      <Section title="أحدث الدرجات">
        <Table
          columns={["المادة", "النوع", "الدرجة", "النسبة", "التاريخ"]}
          rows={asArray(data.recentGrades).map((row) => [text(row.subject), text(row.type), `${text(row.score, "0")} / ${text(row.maxScore, "0")}`, `${text(row.percentage, "0")}%`, date(row.createdAt)])}
        />
      </Section>
      <Section title="آخر المدفوعات">
        <Table
          columns={["الإيصال", "المبلغ", "الطريقة", "التاريخ"]}
          rows={asArray(data.recentPayments).map((row) => [text(row.receiptNumber), money(row.amount), text(row.paymentMethod), date(row.paymentDate)])}
        />
      </Section>
    </div>
  );
}

function ChildrenView({ data }: { data: Plain }) {
  const children = asArray(data.children);
  if (!children.length) return <EmptyState label="لا يوجد أبناء مرتبطون بهذا الحساب بعد." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {children.map((child) => (
        <article key={text(child.id)} className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">{text(child.name)}</h2>
              <p className="text-sm text-muted">{text(child.studentNumber)} · {text(child.academicLevel)} · {text(child.className)}</p>
            </div>
            <Badge value={child.status} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">الفوج</dt><dd className="font-medium">{text(child.groupName)}</dd></div>
            <div><dt className="text-muted">نوع التسجيل</dt><dd className="font-medium">{text(child.enrollmentType)}</dd></div>
            <div><dt className="text-muted">تاريخ التسجيل</dt><dd className="font-medium">{date(child.registrationDate)}</dd></div>
            <div><dt className="text-muted">ملاحظات طبية</dt><dd className="font-medium">{text(child.medicalNotes)}</dd></div>
          </dl>
          <div className="mt-4">
            <p className="text-sm font-semibold">الأساتذة المعينون</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {asArray(child.assignedTeachers).map((teacher) => <span key={`${text(child.id)}-${text(teacher.id)}`} className="rounded-full bg-gray-100 px-3 py-1 text-xs">{text(teacher.name)} · {text(teacher.subject)}</span>)}
              {!asArray(child.assignedTeachers).length && <span className="text-sm text-muted">لا توجد تعيينات حالية.</span>}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function AttendanceView({ data }: { data: Plain }) {
  const summary = asRecord(data.summary);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="إجمالي السجلات" value={summary.total} />
        <StatCard label="الحضور" value={summary.present} tone="primary" />
        <StatCard label="الغياب" value={summary.absent} tone="danger" />
        <StatCard label="التأخر" value={summary.late} />
        <StatCard label="النسبة" value={`${text(summary.attendancePercentage, "0")}%`} />
      </div>
      <Table
        columns={["التاريخ", "الحالة", "السياق", "القسم", "المستوى", "ملاحظات"]}
        rows={asArray(data.records).map((row) => [date(row.date), <Badge key="status" value={row.status} />, text(row.contextType), text(row.className), text(row.academicLevel), text(row.notes || row.excuseReason)])}
      />
    </div>
  );
}

function PerformanceView({ data }: { data: Plain }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {asArray(data.summary).map((row) => <StatCard key={text(row.type)} label={text(row.type)} value={`${text(row.average, "0")}%`} />)}
      </div>
      <Table
        columns={["المادة", "النوع", "الدرجة", "النسبة", "ملاحظات", "نقاط قوة", "نقاط ضعف"]}
        rows={asArray(data.records).map((row) => [text(row.subject), text(row.type), `${text(row.score, "0")} / ${text(row.maxScore, "0")}`, `${text(row.percentage, "0")}%`, text(row.remarks), text(row.strengths), text(row.weaknesses)])}
      />
    </div>
  );
}

function FinanceView({ data }: { data: Plain }) {
  const summary = asRecord(data.summary);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="رسوم التسجيل" value={money(summary.registrationFees)} />
        <StatCard label="الرسوم الشهرية" value={money(summary.monthlyFees)} />
        <StatCard label="الحصص الخاصة" value={money(summary.privateLessons)} />
        <StatCard label="النقل" value={money(summary.transportation)} />
        <StatCard label="إجمالي المستحق" value={money(summary.totalDue)} />
        <StatCard label="إجمالي المدفوع" value={money(summary.totalPaid)} tone="primary" />
        <StatCard label="الخصومات" value={money(summary.discounts)} />
        <StatCard label="المتبقي" value={money(summary.outstandingBalance)} tone="danger" />
      </div>
      <Section title="المدفوعات">
        <Table columns={["الإيصال", "المبلغ", "الطريقة", "التاريخ"]} rows={asArray(data.payments).map((row) => [text(row.receiptNumber), money(row.amount), text(row.paymentMethod), date(row.paymentDate)])} />
      </Section>
      <Section title="المستحقات">
        <Table columns={["النوع", "الوصف", "الحالة", "المبلغ", "المدفوع", "المتبقي", "تاريخ الاستحقاق"]} rows={asArray(data.charges).map((row) => [text(row.type), text(row.description), <Badge key="status" value={row.status} />, money(row.amount), money(row.paid), money(row.balance), date(row.dueDate)])} />
      </Section>
    </div>
  );
}

function SimpleTableView({ mode, data }: { mode: Mode; data: Plain }) {
  if (mode === "private-lessons") {
    return <Table columns={["المادة", "الأستاذ", "التاريخ", "الوقت", "الحالة", "الحضور", "الدفع", "المبلغ"]} rows={asArray(data.lessons).map((row) => [text(row.subject), text(row.teacher), date(row.date), `${text(row.startTime)} - ${text(row.endTime)}`, <Badge key="s" value={row.status} />, <Badge key="a" value={row.attendance} />, <Badge key="p" value={row.paymentStatus} />, money(row.amount)])} />;
  }
  if (mode === "kindergarten") {
    return <Table columns={["الطفل", "المربية", "الفوج", "الجدول", "الاشتراك", "الحالة", "المتبقي"]} rows={asArray(data.registrations).map((row) => [text(row.childName), text(row.teacher), text(row.groupName), text(row.schedule), text(row.subscriptionType), <Badge key="s" value={row.status} />, money(row.totalOutstanding)])} />;
  }
  if (mode === "transportation") {
    return <Table columns={["الحافلة", "المسار", "السائق", "الصعود", "النزول", "الحالة", "من", "إلى"]} rows={asArray(data.subscriptions).map((row) => [text(row.bus), text(row.route), text(row.driver), text(row.pickupPoint), text(row.dropoffPoint), <Badge key="s" value={row.status} />, date(row.startDate), date(row.endDate)])} />;
  }
  if (mode === "documents") {
    return <Table columns={["الطالب", "العنوان", "النوع", "الحالة", "تاريخ الرفع", "تحميل"]} rows={asArray(data.documents).map((row) => [text(row.studentName), text(row.title), text(row.type), <Badge key="s" value={row.verificationStatus} />, date(row.uploadedAt), row.url ? <Link key="d" href={String(row.url)} className="inline-flex items-center gap-1 text-primary"><Download className="h-4 w-4" /> تحميل</Link> : "-"])} />;
  }
  return <EmptyState label="لا توجد بيانات متاحة حاليا." />;
}

function CommunicationsView({ data }: { data: Plain }) {
  return (
    <div className="space-y-6">
      <Section title="الرسائل">
        <Table columns={["القناة", "الموضوع", "المستلم", "الحالة", "التاريخ"]} rows={asArray(data.communications).map((row) => [text(row.channel), text(row.subject), text(row.recipient), <Badge key="s" value={row.status} />, date(row.createdAt)])} />
      </Section>
      <Section title="ملاحظات الأساتذة والإدارة">
        <Table columns={["التصنيف", "الملاحظة", "التاريخ"]} rows={asArray(data.notes).map((row) => [text(row.category), text(row.note), date(row.createdAt)])} />
      </Section>
      <Section title="التنبيهات">
        <Table columns={["العنوان", "الرسالة", "النوع", "التاريخ"]} rows={asArray(data.notifications).map((row) => [text(row.title), text(row.message), <Badge key="s" value={row.type} />, date(row.createdAt)])} />
      </Section>
    </div>
  );
}

function ReportsView({ data }: { data: Plain }) {
  const attendance = asRecord(data.attendance);
  const finance = asRecord(data.finance);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <a href="/api/parent/reports?export=print" target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
          <Printer className="h-4 w-4" /> طباعة التقرير
        </a>
        <a href="/api/parent/reports?export=pdf" target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold">
          <FileText className="h-4 w-4" /> نسخة PDF للطباعة
        </a>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="نسبة الحضور" value={`${text(attendance.attendancePercentage, "0")}%`} />
        <StatCard label="الغياب" value={attendance.absent} tone="danger" />
        <StatCard label="إجمالي المستحق" value={money(finance.totalDue)} />
        <StatCard label="المتبقي" value={money(finance.outstandingBalance)} tone="danger" />
      </div>
      <Section title="ملخص الأداء">
        <Table columns={["النوع", "عدد السجلات", "المتوسط"]} rows={asArray(data.academic).map((row) => [text(row.type), text(row.count, "0"), `${text(row.average, "0")}%`])} />
      </Section>
    </div>
  );
}

function renderMode(mode: Mode, data: Plain) {
  if (mode === "dashboard") return <DashboardView data={data} />;
  if (mode === "children") return <ChildrenView data={data} />;
  if (mode === "attendance") return <AttendanceView data={data} />;
  if (mode === "performance") return <PerformanceView data={data} />;
  if (mode === "finance") return <FinanceView data={data} />;
  if (mode === "communications") return <CommunicationsView data={data} />;
  if (mode === "reports") return <ReportsView data={data} />;
  return <SimpleTableView mode={mode} data={data} />;
}

export default function ParentPortalClient({ mode }: { mode: Mode }) {
  const [data, setData] = useState<Plain>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const meta = titles[mode];
  const Icon = meta.icon;

  const endpoint = useMemo(() => endpoints[mode], [mode]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "تعذر تحميل البيانات");
        if (!cancelled) setData(asRecord(payload));
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "حدث خطأ غير متوقع");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{meta.title}</h1>
            <p className="text-sm text-muted">{meta.description}</p>
          </div>
        </div>
        <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold transition hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> تحديث
        </button>
      </header>
      {loading && <div className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-muted">جاري تحميل البيانات...</div>}
      {!loading && error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5" /> {error}
        </div>
      )}
      {!loading && !error && renderMode(mode, data)}
    </div>
  );
}
