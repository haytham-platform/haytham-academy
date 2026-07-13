"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle, Clock, Eye, RefreshCw, Search, Send, Settings } from "lucide-react";
import Title from "@/components/ui/Title";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";

type Mode = "list" | "new" | "detail" | "edit" | "templates" | "template-new" | "template-detail" | "scheduled" | "jobs" | "settings" | "notifications";

interface Props {
  mode: Mode;
  id?: string;
}

interface Communication {
  _id: string;
  channel: string;
  category: string;
  subject: string;
  content: string;
  recipientCount: number;
  status: string;
  priority: string;
  scheduledAt?: string;
  sentAt?: string;
  errorSummary?: string;
  createdAt?: string;
}

const channels = [
  ["in_app", "إشعار داخلي"],
  ["email", "Email"],
  ["sms", "SMS"],
  ["whatsapp", "WhatsApp"],
  ["administrative_notice", "إشعار إداري"],
  ["phone_call", "مكالمة"],
  ["guardian_meeting", "اجتماع ولي"],
];

const categories = [
  "general",
  "attendance_absence",
  "attendance_lateness",
  "payment_due",
  "payment_overdue",
  "payment_received",
  "receipt_issued",
  "invoice_issued",
  "enrollment_notice",
  "private_lesson_reminder",
  "kindergarten_reminder",
  "transportation_notice",
  "teacher_notice",
  "academic_season_notice",
];

const recipientTypes = [
  ["all_active_students", "كل الطلاب النشطين"],
  ["all_active_teachers", "كل الأساتذة النشطين"],
  ["selected_students", "طلاب محددون"],
  ["selected_guardians", "أولياء محددون"],
  ["selected_teachers", "أساتذة محددون"],
  ["class", "قسم"],
  ["group", "فوج"],
  ["academic_level", "مستوى"],
  ["course", "دورة"],
  ["kindergarten_group", "فوج الروضة"],
  ["transportation_route", "خط النقل"],
  ["custom", "قائمة مخصصة"],
];

function statusClass(status: string) {
  if (["sent", "delivered"].includes(status)) return "bg-green-50 text-green-700";
  if (status === "failed") return "bg-red-50 text-red-700";
  if (["scheduled", "queued", "processing"].includes(status)) return "bg-amber-50 text-amber-700";
  if (status === "cancelled") return "bg-gray-100 text-gray-600";
  return "bg-blue-50 text-blue-700";
}

export default function CommunicationCenterClient({ mode, id }: Props) {
  if (mode === "new" || mode === "edit") return <Composer id={id} />;
  if (mode === "detail") return <CommunicationDetail id={id || ""} />;
  if (mode === "templates" || mode === "template-new" || mode === "template-detail") return <Templates mode={mode} id={id} />;
  if (mode === "settings") return <ProviderSettings />;
  if (mode === "notifications") return <Notifications />;
  return <CommunicationList only={mode === "scheduled" ? "scheduled" : mode === "jobs" ? "jobs" : ""} />;
}

function CommunicationList({ only }: { only?: string }) {
  const [items, setItems] = useState<Communication[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1, hasPrev: false, hasNext: false });
  const [filters, setFilters] = useState({ search: "", channel: "", status: only === "scheduled" ? "scheduled" : "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const pageTitle = only === "scheduled" ? "الرسائل المجدولة" : only === "jobs" ? "وظائف التواصل" : "مركز التواصل";

  useEffect(() => {
    const params = new URLSearchParams({ page: String(pagination.page), limit: "20" });
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    queueMicrotask(() => setLoading(true));
    fetch(`/api/admin/communications?${params}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "تعذر التحميل");
        setItems(data.communications || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1, hasPrev: false, hasNext: false });
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters, pagination.page]);

  return (
    <div dir="rtl">
      <Title title={pageTitle} subtitle="بحث، فلترة، تتبع، وإرسال رسائل الأكاديمية" className="mb-6" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/communications/new" className="btn-primary"><Send className="h-4 w-4" /> رسالة جديدة</Link>
        <Link href="/admin/communications/templates" className="rounded-md border border-border px-3 py-2 text-sm">القوالب</Link>
        <Link href="/admin/communications/scheduled" className="rounded-md border border-border px-3 py-2 text-sm">المجدولة</Link>
        <Link href="/admin/communications/jobs" className="rounded-md border border-border px-3 py-2 text-sm">الوظائف</Link>
        <Link href="/admin/communications/settings" className="rounded-md border border-border px-3 py-2 text-sm"><Settings className="inline h-4 w-4" /> المزودون</Link>
      </div>
      <div className="mb-4 grid gap-3 rounded-lg border border-border bg-white p-4 md:grid-cols-4">
        <input className="input-field" placeholder="بحث" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        <select className="input-field" value={filters.channel} onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}>
          <option value="">كل القنوات</option>
          {channels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="input-field" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">كل الحالات</option>
          {["draft", "scheduled", "queued", "processing", "sent", "partially_sent", "delivered", "failed", "cancelled"].map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => setPagination((p) => ({ ...p, page: 1 }))}><Search className="inline h-4 w-4" /> تطبيق</button>
      </div>
      {error && <ApiErrorAlert error={error} />}
      <div className="rounded-lg border border-border bg-white">
        {loading ? <p className="p-8 text-center text-muted">جاري التحميل...</p> : items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50"><th className="p-3 text-right">الموضوع</th><th className="p-3 text-right">القناة</th><th className="p-3 text-right">الفئة</th><th className="p-3 text-right">المستلمون</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">إجراء</th></tr></thead>
              <tbody>{items.map((item) => <tr key={item._id} className="border-b"><td className="p-3 font-medium">{item.subject || item.content.slice(0, 40)}</td><td className="p-3">{item.channel}</td><td className="p-3">{item.category}</td><td className="p-3">{item.recipientCount}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${statusClass(item.status)}`}>{item.status}</span></td><td className="p-3">{item.createdAt ? new Date(item.createdAt).toLocaleString("ar-DZ") : "-"}</td><td className="p-3"><Link className="text-primary" href={`/admin/communications/${item._id}`}><Eye className="inline h-4 w-4" /> عرض</Link></td></tr>)}</tbody>
            </table>
          </div>
        ) : <EmptyState title="لا توجد اتصالات" description="أنشئ رسالة أو غيّر الفلاتر." />}
      </div>
      <Pagination {...pagination} onPageChange={(page) => setPagination((p) => ({ ...p, page }))} />
    </div>
  );
}

function Composer({ id }: { id?: string }) {
  const [form, setForm] = useState({ channel: "in_app", category: "general", subject: "", content: "", recipientType: "all_active_students", ids: "", className: "", groupName: "", academicLevel: "", priority: "normal", scheduledAt: "", internalNotes: "" });
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/communications/${id}`).then((res) => res.json()).then((data) => {
      const item = data.communication;
      if (item) setForm((f) => ({ ...f, channel: item.channel, category: item.category, subject: item.subject, content: item.content, priority: item.priority, internalNotes: item.internalNotes }));
    }).catch(() => undefined);
  }, [id]);

  const body = useMemo(() => ({
    channel: form.channel,
    category: form.category,
    subject: form.subject,
    content: form.content,
    priority: form.priority,
    scheduledAt: form.scheduledAt,
    internalNotes: form.internalNotes,
    recipientScope: { type: form.recipientType, ids: form.ids.split(",").map((x) => x.trim()).filter(Boolean), filters: { className: form.className, groupName: form.groupName, academicLevel: form.academicLevel } },
  }), [form]);

  async function previewRecipients() {
    const res = await fetch("/api/admin/communications/recipients/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "تعذر المعاينة");
    setPreview(data.preview);
    setError("");
  }

  async function submit(mode: "draft" | "send" | "schedule") {
    setError("");
    const res = await fetch(id ? `/api/admin/communications/${id}` : "/api/admin/communications", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, mode }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "تعذر الحفظ");
    setMessage(mode === "send" ? "تمت معالجة الإرسال" : mode === "schedule" ? "تمت الجدولة" : "تم حفظ المسودة");
    if (!id && data.communication?._id) window.location.href = `/admin/communications/${data.communication._id}`;
  }

  return (
    <div dir="rtl">
      <Title title={id ? "تعديل مسودة" : "رسالة جديدة"} subtitle="استخدم بيانات حقيقية، وعاين المستلمين قبل الإرسال" className="mb-6" />
      {error && <ApiErrorAlert error={error} />}
      {message && <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <select className="input-field" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>{channels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
            <input className="input-field md:col-span-2" placeholder="الموضوع" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <textarea className="input-field min-h-48 md:col-span-2" placeholder="محتوى الرسالة" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            <select className="input-field" value={form.recipientType} onChange={(e) => setForm({ ...form, recipientType: e.target.value })}>{recipientTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <input className="input-field" placeholder="IDs مفصولة بفواصل عند الحاجة" value={form.ids} onChange={(e) => setForm({ ...form, ids: e.target.value })} />
            <input className="input-field" placeholder="القسم" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
            <input className="input-field" placeholder="الفوج" value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} />
            <input className="input-field" placeholder="المستوى" value={form.academicLevel} onChange={(e) => setForm({ ...form, academicLevel: e.target.value })} />
            <input className="input-field" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            <select className="input-field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="normal">عادي</option><option value="high">مهم</option><option value="urgent">عاجل</option></select>
            <textarea className="input-field md:col-span-2" placeholder="ملاحظات داخلية" value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-md border border-border px-3 py-2 text-sm" onClick={previewRecipients}><Eye className="inline h-4 w-4" /> معاينة</button>
            <button className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => submit("draft")}>حفظ مسودة</button>
            <button className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => submit("schedule")}><Clock className="inline h-4 w-4" /> جدولة</button>
            <button className="btn-primary" onClick={() => submit("send")}><Send className="h-4 w-4" /> إرسال الآن</button>
          </div>
        </section>
        <aside className="rounded-lg border border-border bg-white p-4">
          <p className="font-semibold">المعاينة</p>
          <p className="mt-2 text-sm text-muted">الأحرف: {form.content.length} | SMS: {Math.max(1, Math.ceil(form.content.length / 70))}</p>
          {preview ? <div className="mt-4 space-y-2 text-sm"><p>المستلمون: {String(preview.count || 0)}</p><p>المكررون: {String(preview.duplicateCount || 0)}</p><p>غير صالح: {String(preview.invalidCount || 0)}</p><p>ناقص الاتصال: {String(preview.missingContactCount || 0)}</p><p>المزود: {(preview.provider as { configured?: boolean })?.configured ? "مهيأ" : "غير مهيأ"}</p></div> : <p className="mt-4 text-sm text-muted">اضغط معاينة لحساب المستلمين.</p>}
        </aside>
      </div>
    </div>
  );
}

function CommunicationDetail({ id }: { id: string }) {
  const [data, setData] = useState<{ communication?: Communication; deliveries?: Record<string, unknown>[] }>({});
  const [error, setError] = useState("");
  const load = () => fetch(`/api/admin/communications/${id}`).then((res) => res.json().then((body) => ({ ok: res.ok, body }))).then(({ ok, body }) => ok ? setData(body) : setError(body.error || "تعذر التحميل")).catch((err) => setError(err.message));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  async function action(name: "send" | "cancel" | "retry") {
    const res = await fetch(`/api/admin/communications/${id}/${name}`, { method: "POST" });
    if (!res.ok) setError((await res.json()).error || "تعذر التنفيذ");
    else load();
  }
  const item = data.communication;
  return (
    <div dir="rtl">
      <Title title={item?.subject || "تفاصيل التواصل"} subtitle={item ? `${item.channel} - ${item.status}` : ""} className="mb-6" />
      {error && <ApiErrorAlert error={error} />}
      {item && <div className="mb-4 rounded-lg border border-border bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{item.subject || "بدون موضوع"}</p><p className="mt-2 whitespace-pre-line text-sm text-muted">{item.content}</p></div><span className={`h-fit rounded-full px-2 py-1 text-xs ${statusClass(item.status)}`}>{item.status}</span></div><div className="mt-4 flex flex-wrap gap-2"><button className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => action("send")}>إرسال/معالجة</button><button className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => action("retry")}><RefreshCw className="inline h-4 w-4" /> إعادة محاولة</button><button className="rounded-md border border-border px-3 py-2 text-sm text-red-600" onClick={() => action("cancel")}>إلغاء</button><Link className="rounded-md border border-border px-3 py-2 text-sm" href={`/admin/communications/${id}/edit`}>تعديل</Link></div></div>}
      <DeliveryTable rows={data.deliveries || []} />
    </div>
  );
}

function DeliveryTable({ rows }: { rows: Record<string, unknown>[] }) {
  return <div className="rounded-lg border border-border bg-white"><p className="border-b p-3 font-semibold">سجل التسليم</p>{rows.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50"><th className="p-3 text-right">المستلم</th><th className="p-3 text-right">الوجهة</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">الفشل</th></tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-b"><td className="p-3">{String(row.recipientName || "")}</td><td className="p-3">{String(row.destination || "")}</td><td className="p-3">{String(row.status || "")}</td><td className="p-3">{String(row.failureMessage || "")}</td></tr>)}</tbody></table></div> : <EmptyState title="لا يوجد سجل تسليم" description="سيظهر التسليم لكل مستلم بعد الحفظ أو الإرسال." />}</div>;
}

function Templates({ mode, id }: { mode: Mode; id?: string }) {
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ name: "", code: "", category: "general", channel: "in_app", subject: "", content: "" });
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/communications/templates").then((res) => res.json()).then((data) => setTemplates(data.templates || [])).catch((err) => setError(err.message));
    if (id) fetch(`/api/admin/communications/templates/${id}`).then((res) => res.json()).then((data) => data.template && setForm({ name: data.template.name || "", code: data.template.code || "", category: data.template.category || "general", channel: data.template.channel || "in_app", subject: data.template.subject || "", content: data.template.content || "" })).catch(() => undefined);
  }, [id]);
  async function save() {
    const res = await fetch(id ? `/api/admin/communications/templates/${id}` : "/api/admin/communications/templates", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "تعذر حفظ القالب");
    window.location.href = "/admin/communications/templates";
  }
  const editing = mode === "template-new" || mode === "template-detail";
  return <div dir="rtl"><Title title="قوالب التواصل" subtitle="متغيرات آمنة فقط مثل {{student_name}} و {{payment_amount}}" className="mb-6" />{error && <ApiErrorAlert error={error} />}{editing && <div className="mb-4 rounded-lg border border-border bg-white p-4"><div className="grid gap-3 md:grid-cols-2"><input className="input-field" placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input className="input-field" placeholder="الكود" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /><select className="input-field" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>{channels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input className="input-field" placeholder="الفئة" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /><input className="input-field md:col-span-2" placeholder="الموضوع" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /><textarea className="input-field min-h-40 md:col-span-2" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div><button className="btn-primary mt-3" onClick={save}>حفظ القالب</button></div>}<div className="mb-3"><Link href="/admin/communications/templates/new" className="btn-primary">قالب جديد</Link></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{templates.map((t) => <Link key={String(t._id)} href={`/admin/communications/templates/${String(t._id)}`} className="rounded-lg border border-border bg-white p-4"><p className="font-semibold">{String(t.name)}</p><p className="text-sm text-muted">{String(t.category)} - {String(t.channel)}</p><p className="mt-2 line-clamp-2 text-sm">{String(t.content)}</p></Link>)}</div></div>;
}

function ProviderSettings() {
  const [providers, setProviders] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/admin/communications/settings").then((res) => res.json().then((data) => ({ ok: res.ok, data }))).then(({ ok, data }) => ok ? setProviders(data.providers || []) : setError(data.error || "تعذر التحميل")).catch((err) => setError(err.message)); }, []);
  return <div dir="rtl"><Title title="إعدادات مزودي التواصل" subtitle="تعرض حالة الإعداد فقط دون أسرار أو مفاتيح" className="mb-6" />{error && <ApiErrorAlert error={error} />}<div className="grid gap-3 md:grid-cols-3">{providers.map((p) => <div key={String(p.providerType)} className="rounded-lg border border-border bg-white p-4"><p className="font-semibold">{String(p.providerType).toUpperCase()}</p><p className="mt-2 text-sm">المزود: {String(p.providerName)}</p><p className="text-sm">المرسل: {String(p.senderIdentity || "-")}</p><p className={`mt-3 inline-flex rounded-full px-2 py-1 text-xs ${p.enabled ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{String(p.connectionStatus)}</p><p className="mt-2 text-xs text-muted">{String(p.lastFailure || "")}</p></div>)}</div></div>;
}

function Notifications() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [unread, setUnread] = useState(0);
  const load = () => fetch("/api/admin/notifications").then((res) => res.json()).then((data) => { setItems(data.notifications || []); setUnread(data.unreadCount || 0); }).catch(() => undefined);
  useEffect(() => {
    void load();
  }, []);
  async function markAll() { await fetch("/api/admin/notifications/read-all", { method: "POST" }); load(); }
  async function read(id: string) { await fetch(`/api/admin/notifications/${id}/read`, { method: "POST" }); load(); }
  return <div dir="rtl"><Title title="مركز الإشعارات" subtitle={`${unread} غير مقروء`} className="mb-6" /><button className="mb-4 rounded-md border border-border px-3 py-2 text-sm" onClick={markAll}><CheckCircle className="inline h-4 w-4" /> تعليم الكل كمقروء</button><div className="space-y-3">{items.length ? items.map((n) => <div key={String(n._id)} className="rounded-lg border border-border bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold"><Bell className="inline h-4 w-4" /> {String(n.title)}</p><p className="mt-1 text-sm text-muted">{String(n.message)}</p></div><button className="rounded-md border border-border px-2 py-1 text-xs" onClick={() => read(String(n._id))}>مقروء</button></div></div>) : <EmptyState title="لا توجد إشعارات" description="ستظهر إشعارات النظام والتواصل هنا." />}</div></div>;
}
