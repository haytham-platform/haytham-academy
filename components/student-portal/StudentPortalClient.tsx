"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, BookOpen, CalendarCheck, Download, FileText, GraduationCap, Printer, ReceiptText, RefreshCw, User } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/finance-labels";
import { cn } from "@/lib/utils";

type Mode = "dashboard" | "profile" | "schedule" | "courses" | "attendance" | "grades" | "private-lessons" | "finance" | "documents" | "communications" | "reports";
type Plain = Record<string, unknown>;

const endpoints: Record<Mode, string> = {
  dashboard: "/api/student/dashboard",
  profile: "/api/student/profile",
  schedule: "/api/student/schedule",
  courses: "/api/student/courses",
  attendance: "/api/student/attendance",
  grades: "/api/student/grades",
  "private-lessons": "/api/student/private-lessons",
  finance: "/api/student/finance",
  documents: "/api/student/documents",
  communications: "/api/student/communications",
  reports: "/api/student/reports",
};

const titles: Record<Mode, { title: string; description: string; icon: typeof User }> = {
  dashboard: { title: "لوحة الطالب", description: "ملخص حي للدروس، الحضور، العلامات، والتنبيهات.", icon: GraduationCap },
  profile: { title: "ملفي الشخصي", description: "بياناتك الشخصية والأكاديمية ومعلومات التسجيل.", icon: User },
  schedule: { title: "جدولي", description: "الدروس اليومية والأسبوعية والحصص الخاصة.", icon: CalendarCheck },
  courses: { title: "دوراتي", description: "الدورات والمواد والأساتذة وحالة التقدم.", icon: BookOpen },
  attendance: { title: "حضوري", description: "سجل الحضور والغياب والتأخر والأعذار.", icon: CalendarCheck },
  grades: { title: "علاماتي", description: "الواجبات، الاختبارات، الامتحانات، المشاريع، والملاحظات.", icon: GraduationCap },
  "private-lessons": { title: "الحصص الخاصة", description: "جدول الحصص الخاصة والحضور والملاحظات.", icon: GraduationCap },
  finance: { title: "ماليتي", description: "الرسوم، المدفوعات، الإيصالات، والمتبقي المصرح به.", icon: ReceiptText },
  documents: { title: "وثائقي", description: "وثائق التسجيل والشهادات والملفات القابلة للتحميل.", icon: FileText },
  communications: { title: "التواصل", description: "الرسائل والتنبيهات والملاحظات الإدارية.", icon: Bell },
  reports: { title: "تقاريري", description: "تقارير الحضور والأداء قابلة للطباعة والتنزيل.", icon: FileText },
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
  if (["present", "paid", "active", "approved", "accepted", "completed"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (["absent", "failed", "overdue", "suspended", "cancelled"].includes(status)) return "bg-red-50 text-red-700";
  if (["late", "partially_paid", "pending", "scheduled"].includes(status)) return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

function Badge({ value }: { value: unknown }) {
  return <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-semibold", statusClass(value))}>{text(value)}</span>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted">{label}</div>;
}

function StatCard({ label, value, tone = "default" }: { label: string; value: unknown; tone?: "default" | "primary" | "danger" }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-white p-4 shadow-sm", tone === "primary" && "border-primary/30 bg-pink-50", tone === "danger" && "border-red-100 bg-red-50")}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{text(value, "0")}</p>
    </div>
  );
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

function Dashboard({ data }: { data: Plain }) {
  const cards = asRecord(data.cards);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="دروس اليوم" value={cards.todayLessons} tone="primary" />
        <StatCard label="جدول الأسبوع" value={cards.weeklySchedule} />
        <StatCard label="نسبة الحضور" value={`${text(cards.attendancePercentage, "0")}%`} />
        <StatCard label="المعدل الأكاديمي" value={`${text(cards.academicAverage, "0")}%`} />
        <StatCard label="الدورات النشطة" value={cards.activeCourses} />
        <StatCard label="علامات حديثة" value={cards.recentGrades} />
        <StatCard label="امتحانات" value={cards.upcomingExams} />
        <StatCard label="واجبات" value={cards.homework} />
        <StatCard label="حصص خاصة" value={cards.privateLessons} />
        <StatCard label="تنبيهات" value={cards.recentNotifications} />
      </div>
      <Section title="أحدث العلامات">
        <Table columns={["المادة", "النوع", "الدرجة", "النسبة", "ملاحظات"]} rows={asArray(data.recentGrades).map((row) => [text(row.subject), text(row.type), `${text(row.score, "0")} / ${text(row.maxScore, "0")}`, `${text(row.percentage, "0")}%`, text(row.remarks)])} />
      </Section>
      <Section title="الدورات الحالية">
        <CourseTable rows={asArray(data.courses)} />
      </Section>
    </div>
  );
}

function Profile({ data }: { data: Plain }) {
  const profile = asRecord(data.profile);
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">{text(profile.name)}</h2>
        <p className="text-sm text-muted">{text(profile.studentNumber)} · {text(profile.academicLevel)} · {text(profile.className)}</p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {([
            ["الحالة", profile.status],
            ["الموسم الدراسي", profile.academicSeason],
            ["الفوج", profile.groupName],
            ["نوع التسجيل", profile.enrollmentType],
            ["تاريخ التسجيل", date(profile.registrationDate)],
            ["الهاتف", profile.phone],
            ["البريد", profile.email],
            ["العنوان", profile.address],
            ["ولي الأمر", profile.guardianName],
            ["هاتف الولي", profile.guardianPhone],
            ["ملاحظات طبية", profile.medicalNotes],
          ] as Array<[string, unknown]>).map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-semibold">{text(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="space-y-4">
        <Section title="الأساتذة">
          <div className="rounded-2xl border border-border bg-white p-4">
            {asArray(data.assignedTeachers).map((teacher) => <p key={`${text(teacher.id)}-${text(teacher.name)}`} className="border-b border-border py-2 last:border-b-0">{text(teacher.name)} · {text(teacher.subject)}</p>)}
            {!asArray(data.assignedTeachers).length && <p className="text-sm text-muted">لا توجد تعيينات حالية.</p>}
          </div>
        </Section>
        <Section title="الأولياء">
          <div className="rounded-2xl border border-border bg-white p-4">
            {asArray(data.guardians).map((guardian) => <p key={text(guardian.id)} className="border-b border-border py-2 last:border-b-0">{text(guardian.name)} · {text(guardian.relationship)} · {text(guardian.phone)}</p>)}
            {!asArray(data.guardians).length && <p className="text-sm text-muted">لا توجد روابط ولي أمر مسجلة.</p>}
          </div>
        </Section>
      </div>
    </div>
  );
}

function CourseTable({ rows }: { rows: Plain[] }) {
  return (
    <Table
      columns={["الدورة", "الأستاذ", "المستوى", "الوقت", "القاعة", "الحالة", "التقدم"]}
      rows={rows.map((row) => {
        const course = asRecord(row.course);
        const teacher = asRecord(course.teacher);
        return [text(course.title), text(teacher.name), text(course.level), `${text(course.studyDays)} ${text(course.startTime)} - ${text(course.endTime)}`, text(course.room), <Badge key="s" value={row.status} />, `${text(row.progress, "0")}%`];
      })}
    />
  );
}

function Schedule({ data }: { data: Plain }) {
  return <Table columns={["النوع", "العنوان", "الأستاذ", "القاعة", "الأيام", "الوقت", "التاريخ"]} rows={asArray(data.calendar).map((row) => [text(row.type), text(row.title), text(row.teacher), text(row.room), text(row.days), `${text(row.startTime)} - ${text(row.endTime)}`, date(row.startDate)])} />;
}

function Courses({ data }: { data: Plain }) {
  return <CourseTable rows={asArray(data.courses)} />;
}

function Attendance({ data }: { data: Plain }) {
  const summary = asRecord(data.summary);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="الإجمالي" value={summary.total} />
        <StatCard label="حاضر" value={summary.present} tone="primary" />
        <StatCard label="غائب" value={summary.absent} tone="danger" />
        <StatCard label="متأخر" value={summary.late} />
        <StatCard label="النسبة" value={`${text(summary.attendancePercentage, "0")}%`} />
      </div>
      <Table columns={["التاريخ", "الحالة", "السياق", "القسم", "المستوى", "ملاحظات"]} rows={asArray(data.records).map((row) => [date(row.date), <Badge key="s" value={row.status} />, text(row.contextType), text(row.className), text(row.academicLevel), text(row.notes || row.excuseReason)])} />
    </div>
  );
}

function Grades({ data }: { data: Plain }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="المعدل العام" value={`${text(data.overallAverage, "0")}%`} tone="primary" />
        {asArray(data.subjectAverages).map((row) => <StatCard key={text(row.subject)} label={text(row.subject)} value={`${text(row.average, "0")}%`} />)}
      </div>
      <Table columns={["المادة", "النوع", "الفترة", "الدرجة", "النسبة", "ملاحظات", "توصيات"]} rows={asArray(data.records).map((row) => [text(row.subject), text(row.type), text(row.academicPeriod), `${text(row.score, "0")} / ${text(row.maxScore, "0")}`, `${text(row.percentage, "0")}%`, text(row.remarks), text(row.recommendations)])} />
    </div>
  );
}

function PrivateLessons({ data }: { data: Plain }) {
  return <Table columns={["المادة", "الأستاذ", "التاريخ", "الوقت", "المكان", "الحالة", "الحضور", "ملاحظات"]} rows={asArray(data.lessons).map((row) => [text(row.subject), text(row.teacher), date(row.date), `${text(row.startTime)} - ${text(row.endTime)}`, text(row.room), <Badge key="s" value={row.status} />, <Badge key="a" value={row.attendance} />, text(row.notes)])} />;
}

function Finance({ data }: { data: Plain }) {
  const summary = asRecord(data.summary);
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="رسوم التسجيل" value={money(summary.registrationFees)} />
        <StatCard label="الرسوم الشهرية" value={money(summary.monthlyFees)} />
        <StatCard label="الحصص الخاصة" value={money(summary.privateLessons)} />
        <StatCard label="النقل" value={money(summary.transportation)} />
        <StatCard label="إجمالي المستحق" value={money(summary.totalDue)} />
        <StatCard label="المدفوع" value={money(summary.totalPaid)} tone="primary" />
        <StatCard label="الخصومات" value={money(summary.discounts)} />
        <StatCard label="المتبقي" value={money(summary.outstandingBalance)} tone="danger" />
      </div>
      <Section title="المدفوعات">
        <Table columns={["الإيصال", "المبلغ", "الطريقة", "التاريخ"]} rows={asArray(data.payments).map((row) => [text(row.receiptNumber), money(row.amount), text(row.paymentMethod), date(row.paymentDate)])} />
      </Section>
      <Section title="المستحقات">
        <Table columns={["النوع", "الوصف", "الحالة", "المبلغ", "المدفوع", "المتبقي", "الاستحقاق"]} rows={asArray(data.charges).map((row) => [text(row.type), text(row.description), <Badge key="s" value={row.status} />, money(row.amount), money(row.paid), money(row.balance), date(row.dueDate)])} />
      </Section>
    </div>
  );
}

function Documents({ data }: { data: Plain }) {
  return <Table columns={["العنوان", "النوع", "الحالة", "تاريخ الرفع", "ملاحظات", "تحميل"]} rows={asArray(data.documents).map((row) => [text(row.title), text(row.type), <Badge key="s" value={row.verificationStatus} />, date(row.uploadedAt), text(row.notes), row.url ? <Link key="d" href={String(row.url)} className="inline-flex items-center gap-1 text-primary"><Download className="h-4 w-4" /> تحميل</Link> : "-"])} />;
}

function Communications({ data }: { data: Plain }) {
  return (
    <div className="space-y-6">
      <Section title="الرسائل">
        <Table columns={["القناة", "الموضوع", "المستلم", "الحالة", "التاريخ"]} rows={asArray(data.communications).map((row) => [text(row.channel), text(row.subject), text(row.recipient), <Badge key="s" value={row.status} />, date(row.createdAt)])} />
      </Section>
      <Section title="الملاحظات">
        <Table columns={["التصنيف", "الملاحظة", "التاريخ"]} rows={asArray(data.notes).map((row) => [text(row.category), text(row.note), date(row.createdAt)])} />
      </Section>
      <Section title="التنبيهات">
        <Table columns={["العنوان", "الرسالة", "النوع", "التاريخ"]} rows={asArray(data.notifications).map((row) => [text(row.title), text(row.message), <Badge key="s" value={row.type} />, date(row.createdAt)])} />
      </Section>
    </div>
  );
}

function Reports({ data }: { data: Plain }) {
  const attendance = asRecord(data.attendance);
  const academic = asRecord(data.academic);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <a href="/api/student/reports?export=print" target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
          <Printer className="h-4 w-4" /> طباعة التقرير
        </a>
        <a href="/api/student/reports?export=pdf" target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold">
          <FileText className="h-4 w-4" /> تحميل PDF
        </a>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="نسبة الحضور" value={`${text(attendance.attendancePercentage, "0")}%`} />
        <StatCard label="الغياب" value={attendance.absent} tone="danger" />
        <StatCard label="التأخر" value={attendance.late} />
        <StatCard label="المعدل العام" value={`${text(academic.overallAverage, "0")}%`} tone="primary" />
      </div>
      <Table columns={["المادة", "عدد السجلات", "المتوسط"]} rows={asArray(academic.subjectAverages).map((row) => [text(row.subject), text(row.count, "0"), `${text(row.average, "0")}%`])} />
    </div>
  );
}

function renderMode(mode: Mode, data: Plain) {
  if (mode === "dashboard") return <Dashboard data={data} />;
  if (mode === "profile") return <Profile data={data} />;
  if (mode === "schedule") return <Schedule data={data} />;
  if (mode === "courses") return <Courses data={data} />;
  if (mode === "attendance") return <Attendance data={data} />;
  if (mode === "grades") return <Grades data={data} />;
  if (mode === "private-lessons") return <PrivateLessons data={data} />;
  if (mode === "finance") return <Finance data={data} />;
  if (mode === "documents") return <Documents data={data} />;
  if (mode === "communications") return <Communications data={data} />;
  return <Reports data={data} />;
}

export default function StudentPortalClient({ mode }: { mode: Mode }) {
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
