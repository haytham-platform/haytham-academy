"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, CalendarCheck, Edit, Eye, PlayCircle, RefreshCw } from "lucide-react";
import Title from "@/components/ui/Title";
import EmptyState from "@/components/ui/EmptyState";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import Pagination from "@/components/ui/Pagination";

interface Season {
  _id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  status: string;
  isCurrent: boolean;
  isOpenForRegistration: boolean;
}

const defaultPagination = { page: 1, limit: 20, total: 0, totalPages: 1, hasPrev: false, hasNext: false };

export default function AcademicSeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(defaultPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/academic-seasons?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "تعذر تحميل المواسم");
    setSeasons(data.seasons || []);
    setPagination(data.pagination || defaultPagination);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [page, status]);

  async function transition(id: string, action: string) {
    const reason = action === "archive" ? prompt("سبب الأرشفة") || "" : "";
    const res = await fetch(`/api/admin/academic-seasons/${id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transition: action, reason }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "تعذر تنفيذ العملية");
      return;
    }
    await load();
  }

  return (
    <div dir="rtl">
      <Title title="إدارة المواسم الدراسية" subtitle="إنشاء المواسم، تفعيلها، إغلاقها، وأرشفتها مع حفظ التاريخ الأكاديمي." className="mb-6" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin/academic-seasons/new" className="btn-primary">موسم جديد</Link>
        <Link href="/admin/academic-seasons/rollover-jobs" className="rounded-lg border border-border bg-white px-3 py-2 text-sm">مهام الترحيل</Link>
        <input className="input-field max-w-xs" placeholder="بحث" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input-field max-w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="upcoming">قادم</option>
          <option value="active">نشط</option>
          <option value="closed">مغلق</option>
          <option value="archived">مؤرشف</option>
        </select>
        <button className="rounded-lg border border-border bg-white px-3 py-2 text-sm" onClick={load}><RefreshCw className="inline h-4 w-4" /> تحديث</button>
      </div>
      {error && <ApiErrorAlert error={error} />}
      <div className="rounded-lg border border-border bg-white">
        {loading ? <p className="p-8 text-center text-muted">جاري التحميل...</p> : seasons.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50"><th className="p-3 text-right">الموسم</th><th className="p-3 text-right">المدة</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">التسجيل</th><th className="p-3 text-right">إجراءات</th></tr></thead>
              <tbody>
                {seasons.map((season) => (
                  <tr key={season._id} className="border-b">
                    <td className="p-3"><strong>{season.name}</strong><p className="text-xs text-muted">{season.code}{season.isCurrent ? " - الحالي" : ""}</p></td>
                    <td className="p-3">{new Date(season.startDate).toLocaleDateString("ar-DZ")} - {new Date(season.endDate).toLocaleDateString("ar-DZ")}</td>
                    <td className="p-3">{season.status}</td>
                    <td className="p-3">{season.isOpenForRegistration ? "مفتوح" : "مغلق"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Link title="عرض" href={`/admin/academic-seasons/${season._id}`}><Eye className="h-4 w-4" /></Link>
                        <Link title="تعديل" href={`/admin/academic-seasons/${season._id}/edit`}><Edit className="h-4 w-4" /></Link>
                        <Link title="ترحيل" href={`/admin/academic-seasons/${season._id}/rollover`}><PlayCircle className="h-4 w-4" /></Link>
                        <button title="تفعيل" onClick={() => transition(season._id, "activate")}><CalendarCheck className="h-4 w-4" /></button>
                        <button title="أرشفة" onClick={() => transition(season._id, "archive")}><Archive className="h-4 w-4 text-red-700" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="لا توجد مواسم" description="أنشئ أول موسم دراسي للبدء في إدارة الترحيل والأرشفة." />}
      </div>
      <Pagination {...pagination} onPageChange={setPage} />
    </div>
  );
}
