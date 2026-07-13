"use client";

import { useEffect, useState } from "react";
import { Download, Printer, RotateCcw, Search } from "lucide-react";
import Title from "@/components/ui/Title";
import EmptyState from "@/components/ui/EmptyState";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import Pagination from "@/components/ui/Pagination";

interface ArchiveRecord { _id: string; name?: string; title?: string; childName?: string; code?: string; status?: string; deletedAt?: string; archivedAt?: string; archiveReason?: string; updatedAt?: string }
const defaultPagination = { page: 1, limit: 20, total: 0, totalPages: 1, hasPrev: false, hasNext: false };
const TYPES = [
  ["seasons", "المواسم"],
  ["students", "الطلاب"],
  ["enrollments", "التسجيلات"],
  ["courses", "الدورات"],
  ["teachers", "الأساتذة"],
  ["transportation", "النقل"],
  ["kindergarten", "الروضة"],
] as const;

export default function ArchivePage() {
  const [type, setType] = useState("students");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(defaultPagination);
  const [error, setError] = useState("");
  async function load() {
    const params = new URLSearchParams({ type, page: String(page) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/archive?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "تعذر تحميل الأرشيف");
    setRecords(data.records || []);
    setPagination(data.pagination || defaultPagination);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [type, page]);
  async function restore(id: string) {
    const reason = prompt("سبب الاستعادة") || "";
    const res = await fetch("/api/admin/archive/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, reason }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "تعذر الاستعادة");
      return;
    }
    await load();
  }
  function label(record: ArchiveRecord) {
    return record.name || record.title || record.childName || record.code || record._id;
  }
  return (
    <div dir="rtl">
      <Title title="مركز الأرشيف" subtitle="وصول تاريخي للبيانات المؤرشفة مع استعادة مصرح بها وتصدير/طباعة." className="mb-6" />
      {error && <ApiErrorAlert error={error} />}
      <div className="mb-4 flex flex-wrap gap-2">
        {TYPES.map(([key, label]) => <button key={key} className={`rounded-lg border px-3 py-2 text-sm ${type === key ? "border-primary bg-primary text-white" : "border-border bg-white"}`} onClick={() => { setType(key); setPage(1); }}>{label}</button>)}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input-field max-w-xs" placeholder="بحث" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn-primary" onClick={load}><Search className="h-4 w-4" /> بحث</button>
        <button className="rounded-lg border border-border bg-white px-3 py-2 text-sm" onClick={() => window.print()}><Printer className="inline h-4 w-4" /> طباعة</button>
        <a className="rounded-lg border border-border bg-white px-3 py-2 text-sm" href={`/api/admin/archive?type=${type}&search=${encodeURIComponent(search)}`}><Download className="inline h-4 w-4" /> تصدير</a>
      </div>
      <div className="rounded-lg border border-border bg-white">
        {records.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50"><th className="p-3 text-right">السجل</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">تاريخ الأرشفة</th><th className="p-3 text-right">السبب</th><th className="p-3 text-right">إجراءات</th></tr></thead><tbody>
          {records.map((record) => <tr key={record._id} className="border-b"><td className="p-3">{label(record)}<p className="text-xs text-muted">{record._id}</p></td><td className="p-3">{record.status || "archived"}</td><td className="p-3">{record.archivedAt || record.deletedAt ? new Date(record.archivedAt || record.deletedAt || "").toLocaleString("ar-DZ") : "—"}</td><td className="p-3">{record.archiveReason || "—"}</td><td className="p-3"><button className="text-primary" onClick={() => restore(record._id)}><RotateCcw className="inline h-4 w-4" /> استعادة</button></td></tr>)}
        </tbody></table></div> : <EmptyState title="لا توجد سجلات مؤرشفة" description="غيّر الفلاتر أو اختر نوعاً آخر." />}
      </div>
      <Pagination {...pagination} onPageChange={setPage} />
    </div>
  );
}
