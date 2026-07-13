"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Download, FileText, Printer, RefreshCw, Save, Search } from "lucide-react";
import Title from "@/components/ui/Title";
import EmptyState from "@/components/ui/EmptyState";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";

type Mode = "dashboard" | "profile" | "schedule" | "students" | "attendance" | "grades" | "private-lessons" | "finance" | "communications" | "documents" | "reports";
type Row = Record<string, unknown>;

const endpoints: Record<Mode, string> = {
  dashboard: "/api/teacher/dashboard",
  profile: "/api/teacher/profile",
  schedule: "/api/teacher/schedule",
  students: "/api/teacher/students",
  attendance: "/api/teacher/attendance",
  grades: "/api/teacher/grades",
  "private-lessons": "/api/teacher/private-lessons",
  finance: "/api/teacher/finance",
  communications: "/api/teacher/communications",
  documents: "/api/teacher/documents",
  reports: "/api/teacher/reports",
};

const titles: Record<Mode, string> = {
  dashboard: "لوحة الأستاذ",
  profile: "ملفي المهني",
  schedule: "جدولي",
  students: "طلابي",
  attendance: "الحضور",
  grades: "النقاط والتقييم",
  "private-lessons": "الحصص الخاصة",
  finance: "المالية",
  communications: "التواصل",
  documents: "الوثائق",
  reports: "تقاريري",
};

function fmt(value: unknown) {
  if (typeof value === "number") return value.toLocaleString("ar-DZ");
  if (value instanceof Date) return value.toLocaleDateString("ar-DZ");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return new Date(value).toLocaleDateString("ar-DZ");
  return String(value ?? "-");
}

function money(value: unknown) {
  return `${Number(value || 0).toLocaleString("ar-DZ")} DZD`;
}

export default function TeacherDashboardClient({ mode }: { mode: Mode }) {
  const [data, setData] = useState<Row>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => setLoading(true));
    fetch(endpoints[mode])
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (!active) return;
        if (!ok) throw new Error(body.error || "تعذر التحميل");
        setData(body);
        setError("");
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [mode, refresh]);

  return (
    <div dir="rtl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <Title title={titles[mode]} subtitle="Haytham Educational Academy" />
        <button type="button" onClick={() => setRefresh((v) => v + 1)} className="rounded-md border border-border px-3 py-2 text-sm">
          <RefreshCw className="inline h-4 w-4" /> تحديث
        </button>
      </div>
      {error && <ApiErrorAlert error={error} />}
      {loading ? <p className="rounded-lg border border-border bg-white p-8 text-center text-muted">جاري التحميل...</p> : <TeacherContent mode={mode} data={data} onRefresh={() => setRefresh((v) => v + 1)} />}
    </div>
  );
}

function TeacherContent({ mode, data, onRefresh }: { mode: Mode; data: Row; onRefresh: () => void }) {
  if (mode === "dashboard") return <Dashboard data={data} />;
  if (mode === "profile") return <Profile teacher={(data.teacher || {}) as Row} />;
  if (mode === "schedule") return <Schedule data={data} />;
  if (mode === "students") return <Students />;
  if (mode === "attendance") return <Attendance onRefresh={onRefresh} />;
  if (mode === "grades") return <Grades onRefresh={onRefresh} />;
  if (mode === "private-lessons") return <PrivateLessons data={data} />;
  if (mode === "finance") return <Finance data={data} />;
  if (mode === "communications") return <Communications data={data} />;
  if (mode === "documents") return <Documents data={data} />;
  return <Reports data={data} />;
}

function Dashboard({ data }: { data: Row }) {
  const cards = (data.cards || {}) as Row;
  const items = [
    ["حصص اليوم", cards.todayLessons],
    ["حصص الأسبوع", cards.weeklyLessons],
    ["الطلاب النشطون", cards.activeStudents],
    ["حصص خاصة اليوم", cards.privateLessonsToday],
    ["حضور اليوم", cards.attendanceToday],
    ["حضور معلق", cards.pendingAttendance],
    ["نقاط معلقة", cards.pendingGrades],
    ["حصص قادمة", cards.upcomingLessons],
    ["أرباح الشهر", money(cards.monthlyEarnings)],
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {items.map(([label, value]) => <Stat key={String(label)} label={String(label)} value={fmt(value)} />)}
      </div>
      <Panel title="الحصص القادمة"><LessonList rows={(data.upcomingLessons || []) as Row[]} /></Panel>
      <Panel title="آخر الإشعارات"><NotificationList rows={(data.notifications || []) as Row[]} /></Panel>
    </div>
  );
}

function Profile({ teacher }: { teacher: Row }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="المعلومات الشخصية"><Info rows={[["الاسم", teacher.name], ["الهاتف", teacher.phone], ["البريد", teacher.email], ["العنوان", teacher.address], ["هاتف الطوارئ", teacher.emergencyPhone]]} /></Panel>
      <Panel title="المعلومات المهنية"><Info rows={[["المادة", teacher.subject], ["المستوى", teacher.teachingLevel], ["نوع التوظيف", teacher.employmentType], ["الحالة", teacher.status], ["الأقسام", ((teacher.assignedClasses || []) as unknown[]).join(", ")]]} /></Panel>
      <Panel title="المواد والمستويات"><Info rows={[["المواد", ((teacher.subjects || []) as unknown[]).join(", ")], ["المستويات", ((teacher.academicLevels || []) as unknown[]).join(", ")]]} /></Panel>
      <Panel title="المؤهلات"><SimpleTable rows={(teacher.qualifications || []) as Row[]} columns={["degree", "institution", "field", "year"]} /></Panel>
    </div>
  );
}

function Schedule({ data }: { data: Row }) {
  return (
    <div className="space-y-4">
      <Panel title="الجدول الأسبوعي"><SimpleTable rows={(data.weeklySchedule || []) as Row[]} columns={["day", "startTime", "endTime", "className", "subject", "room"]} /></Panel>
      <Panel title="الدورات"><SimpleTable rows={(data.courses || []) as Row[]} columns={["title", "studyDays", "startTime", "endTime", "room"]} /></Panel>
      <Panel title="الحصص الخاصة"><LessonList rows={(data.privateLessons || []) as Row[]} /></Panel>
    </div>
  );
}

function Students() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    const res = await fetch(`/api/teacher/students?${params}`);
    const body = await res.json();
    if (!res.ok) return setError(body.error || "تعذر تحميل الطلاب");
    setRows(body.students || []);
    setError("");
  }, [query]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return <div className="space-y-4">{error && <ApiErrorAlert error={error} />}<div className="flex gap-2"><input className="input-field" placeholder="بحث" value={query} onChange={(e) => setQuery(e.target.value)} /><button className="rounded-md border border-border px-3 py-2 text-sm" onClick={load}><Search className="inline h-4 w-4" /> بحث</button></div><Panel title="الطلاب المسندون"><SimpleTable rows={rows} columns={["name", "academicLevel", "className", "groupName", "guardianName", "guardianPhone", "status"]} /></Panel></div>;
}

function Attendance({ onRefresh }: { onRefresh: () => void }) {
  const [records, setRecords] = useState<Row[]>([]);
  const [form, setForm] = useState({ studentId: "", status: "present", date: new Date().toISOString().slice(0, 10), className: "", notes: "" });
  const [error, setError] = useState("");
  async function load() {
    const res = await fetch("/api/teacher/attendance");
    const body = await res.json();
    if (res.ok) setRecords(body.records || []);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function save() {
    const res = await fetch("/api/teacher/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error || "تعذر الحفظ");
    setError("");
    await load();
    onRefresh();
  }
  return <div className="space-y-4">{error && <ApiErrorAlert error={error} />}<Panel title="تسجيل حضور"><div className="grid gap-3 md:grid-cols-5"><input className="input-field" placeholder="معرف الطالب" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} /><select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="present">حاضر</option><option value="absent">غائب</option><option value="late">متأخر</option><option value="excused">مبرر</option><option value="left_early">غادر مبكرا</option></select><input className="input-field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /><input className="input-field" placeholder="القسم" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} /><button className="btn-primary" onClick={save}><Save className="h-4 w-4" /> حفظ</button></div></Panel><Panel title="سجل الحضور"><SimpleTable rows={records} columns={["studentId", "date", "status", "className", "notes"]} /></Panel></div>;
}

function Grades({ onRefresh }: { onRefresh: () => void }) {
  const [records, setRecords] = useState<Row[]>([]);
  const [form, setForm] = useState({ studentId: "", subject: "", type: "test", score: "", maxScore: "20", remarks: "" });
  const [error, setError] = useState("");
  async function load() {
    const res = await fetch("/api/teacher/grades");
    const body = await res.json();
    if (res.ok) setRecords(body.records || []);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function save() {
    const res = await fetch("/api/teacher/grades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error || "تعذر الحفظ");
    setError("");
    await load();
    onRefresh();
  }
  return <div className="space-y-4">{error && <ApiErrorAlert error={error} />}<Panel title="إضافة نقطة"><div className="grid gap-3 md:grid-cols-6"><input className="input-field" placeholder="معرف الطالب" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} /><input className="input-field" placeholder="المادة" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /><select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="test">اختبار</option><option value="exam">امتحان</option><option value="homework">واجب</option><option value="project">مشروع</option><option value="participation">مشاركة</option></select><input className="input-field" placeholder="النقطة" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /><input className="input-field" placeholder="من" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} /><button className="btn-primary" onClick={save}><Save className="h-4 w-4" /> حفظ</button></div></Panel><Panel title="سجل النقاط"><SimpleTable rows={records} columns={["studentId", "subject", "type", "score", "maxScore", "average", "remarks"]} /></Panel></div>;
}

function PrivateLessons({ data }: { data: Row }) {
  return <div className="space-y-4"><Panel title="حصصي الخاصة"><LessonList rows={(data.lessons || []) as Row[]} /></Panel><Panel title="الملاحظات"><SimpleTable rows={(data.notes || []) as Row[]} columns={["note", "type", "visibility", "createdAt"]} /></Panel></div>;
}

function Finance({ data }: { data: Row }) {
  const summary = (data.summary || {}) as Row;
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-5"><Stat label="الرصيد الحالي" value={money(summary.currentBalance)} /><Stat label="الإجمالي" value={money(summary.totalEarnings)} /><Stat label="مدفوع" value={money(summary.paid)} /><Stat label="معلق" value={money(summary.pending)} /><Stat label="اقتطاعات" value={money(summary.deductions)} /></div><Panel title="الفواتير والمستحقات"><SimpleTable rows={(data.payouts || []) as Row[]} columns={["recordType", "invoicePeriod", "netTeacherAmount", "paid", "remaining", "paymentStatus"]} /></Panel><Panel title="سجل الدفع"><SimpleTable rows={(data.payments || []) as Row[]} columns={["receiptNumber", "amount", "paymentDate", "paymentMethod", "status"]} /></Panel></div>;
}

function Communications({ data }: { data: Row }) {
  return <div className="space-y-4"><Panel title="الإشعارات"><NotificationList rows={(data.notifications || []) as Row[]} /></Panel><Panel title="تواصل الأولياء والطلاب"><SimpleTable rows={(data.communications || []) as Row[]} columns={["type", "subject", "recipient", "deliveryStatus", "createdAt"]} /></Panel></div>;
}

function Documents({ data }: { data: Row }) {
  return <div className="space-y-4"><Panel title="العقود"><DocumentList rows={(data.contracts || []) as Row[]} /></Panel><Panel title="الوثائق"><DocumentList rows={(data.documents || []) as Row[]} /></Panel></div>;
}

function Reports({ data }: { data: Row }) {
  const report = (data.report || {}) as Row;
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><button className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => window.print()}><Printer className="inline h-4 w-4" /> طباعة</button><a className="rounded-md border border-border px-3 py-2 text-sm" href="/api/teacher/reports?export=excel" target="_blank"><Download className="inline h-4 w-4" /> Excel</a><a className="rounded-md border border-border px-3 py-2 text-sm" href="/api/teacher/reports?export=pdf" target="_blank"><FileText className="inline h-4 w-4" /> PDF</a></div><Panel title="ملخص الحضور"><SimpleTable rows={(report.attendance || []) as Row[]} columns={["_id", "count"]} /></Panel><Panel title="ملخص النقاط"><SimpleTable rows={(report.grades || []) as Row[]} columns={["_id", "count", "average"]} /></Panel><div className="grid gap-3 md:grid-cols-2"><Stat label="الدورات" value={fmt(report.lessons)} /><Stat label="الحصص الخاصة" value={fmt(report.privateLessons)} /></div></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-border bg-white p-4"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-white p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>;
}

function Info({ rows }: { rows: Array<[string, unknown]> }) {
  return <dl className="grid gap-3 text-sm">{rows.map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="font-medium">{fmt(value)}</dd></div>)}</dl>;
}

function SimpleTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  if (!rows.length) return <EmptyState title="لا توجد بيانات" description="لا توجد سجلات مطابقة حاليا." />;
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50">{columns.map((c) => <th key={c} className="p-3 text-right">{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-b">{columns.map((c) => <td key={c} className="p-3 align-top">{fmt(row[c])}</td>)}</tr>)}</tbody></table></div>;
}

function LessonList({ rows }: { rows: Row[] }) {
  if (!rows.length) return <EmptyState title="لا توجد حصص" description="لا توجد حصص ضمن هذا النطاق." />;
  return <SimpleTable rows={rows} columns={["subject", "academicLevel", "lessonDate", "startTime", "endTime", "room", "status", "paymentStatus"]} />;
}

function NotificationList({ rows }: { rows: Row[] }) {
  if (!rows.length) return <EmptyState title="لا توجد إشعارات" description="ستظهر الإشعارات الحديثة هنا." />;
  return <div className="space-y-2">{rows.map((n, i) => <div key={String(n._id || i)} className="rounded-md border border-border p-3"><p className="font-medium"><Bell className="inline h-4 w-4" /> {fmt(n.title)}</p><p className="mt-1 text-sm text-muted">{fmt(n.message)}</p></div>)}</div>;
}

function DocumentList({ rows }: { rows: Row[] }) {
  if (!rows.length) return <EmptyState title="لا توجد وثائق" description="لا توجد وثائق متاحة لهذا الحساب." />;
  return <div className="grid gap-3 md:grid-cols-2">{rows.map((doc, i) => <a key={i} href={String(doc.url || "#")} target="_blank" className="rounded-lg border border-border p-4 hover:border-primary"><p className="font-semibold">{fmt(doc.title)}</p><p className="text-sm text-muted">{fmt(doc.type || doc.status)}</p><p className="mt-2 text-xs text-primary">تحميل</p></a>)}</div>;
}

