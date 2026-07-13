"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Title from "@/components/ui/Title";
import EmptyState from "@/components/ui/EmptyState";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import Pagination from "@/components/ui/Pagination";

interface Job { _id: string; sourceSeason: string; targetSeason: string; status: string; totalStudents: number; completed: number; failed: number; skipped: number; warnings: number; startedAt?: string; completedAt?: string; createdAt: string; errorSummary?: string }
const defaultPagination = { page: 1, limit: 20, total: 0, totalPages: 1, hasPrev: false, hasNext: false };

export default function RolloverJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [pagination, setPagination] = useState(defaultPagination);
  const [error, setError] = useState("");
  async function load() {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    const res = await fetch(`/api/admin/academic-seasons/rollover-jobs?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "تعذر تحميل المهام");
    setJobs(data.jobs || []);
    setPagination(data.pagination || defaultPagination);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [page, status]);
  return (
    <div dir="rtl">
      <Title title="مهام ترحيل المواسم" subtitle="متابعة المعاينات والتنفيذ والفشل والتحذيرات." className="mb-6" />
      {error && <ApiErrorAlert error={error} />}
      <div className="mb-4 flex gap-2">
        <select className="input-field max-w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">كل الحالات</option><option value="draft">مسودة</option><option value="previewed">تمت المعاينة</option><option value="ready">جاهزة</option><option value="running">قيد التنفيذ</option><option value="completed">مكتملة</option><option value="completed_with_warnings">مكتملة بتحذيرات</option><option value="failed">فشلت</option><option value="cancelled">ملغاة</option>
        </select>
      </div>
      <div className="rounded-lg border border-border bg-white">
        {jobs.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50"><th className="p-3 text-right">المهمة</th><th className="p-3 text-right">المواسم</th><th className="p-3 text-right">الطلاب</th><th className="p-3 text-right">التقدم</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">المدة</th><th className="p-3 text-right">إجراءات</th></tr></thead><tbody>
          {jobs.map((job) => {
            const started = job.startedAt ? new Date(job.startedAt).getTime() : 0;
            const completed = job.completedAt ? new Date(job.completedAt).getTime() : 0;
            return <tr key={job._id} className="border-b"><td className="p-3 font-mono text-xs">{job._id}</td><td className="p-3">{job.sourceSeason} ← {job.targetSeason}</td><td className="p-3">{job.totalStudents}</td><td className="p-3">تم {job.completed} / فشل {job.failed} / تخطي {job.skipped} / تحذيرات {job.warnings}</td><td className="p-3">{job.status}</td><td className="p-3">{started && completed ? `${Math.round((completed - started) / 1000)} ث` : "—"}</td><td className="p-3"><Link className="text-primary" href={`/admin/academic-seasons/rollover-jobs?job=${job._id}`}>تدقيق</Link></td></tr>;
          })}
        </tbody></table></div> : <EmptyState title="لا توجد مهام" description="أنشئ معاينة ترحيل من صفحة موسم دراسي." />}
      </div>
      <Pagination {...pagination} onPageChange={setPage} />
    </div>
  );
}
