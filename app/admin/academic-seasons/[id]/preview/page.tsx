"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Title from "@/components/ui/Title";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";

interface JobItem { _id: string; preview: Record<string, unknown>; action: string; status: string; conflicts: { code: string; message: string }[]; warnings: { code: string; message: string }[]; sourceAcademicLevel?: string; targetAcademicLevel?: string; sourceClass?: string; targetClass?: string; sourceGroup?: string; targetGroup?: string }
interface Job { _id: string; status: string; sourceSeason: string; targetSeason: string; totalStudents: number; completed: number; failed: number; skipped: number; warnings: number; items: JobItem[] }

export default function RolloverPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const jobId = params.get("job") || "";
  const [job, setJob] = useState<Job | null>(null);
  const [overrideWarnings, setOverrideWarnings] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState("");
  async function load() {
    if (!jobId) return;
    const res = await fetch(`/api/admin/academic-seasons/rollover-jobs/${jobId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "تعذر تحميل المعاينة");
    else setJob(data.job);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [jobId]);
  async function execute() {
    const res = await fetch(`/api/admin/academic-seasons/rollover-jobs/${jobId}/execute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overrideWarnings, overrideReason }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "تعذر التنفيذ");
    setJob(data.job);
  }
  const blockers = job?.items.reduce((sum, item) => sum + item.conflicts.length, 0) ?? 0;
  return (
    <div dir="rtl">
      <Title title="معاينة الترحيل" subtitle={job ? `${job.sourceSeason} ← ${job.targetSeason}` : ""} className="mb-6" />
      {error && <ApiErrorAlert error={error} />}
      {job && (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-5">
            <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted">الحالة</p><strong>{job.status}</strong></div>
            <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted">الطلاب</p><strong>{job.totalStudents}</strong></div>
            <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted">تحذيرات</p><strong>{job.warnings}</strong></div>
            <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted">تعارضات حرجة</p><strong>{blockers}</strong></div>
            <div className="rounded-lg border bg-white p-3"><p className="text-xs text-muted">مكتمل</p><strong>{job.completed}</strong></div>
          </div>
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">لا يتم تنفيذ الترحيل إذا وجدت تعارضات حرجة. تجاوز التحذيرات يتطلب سبباً واضحاً ويتم تسجيله في التدقيق.</div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overrideWarnings} onChange={(e) => setOverrideWarnings(e.target.checked)} /> تجاوز التحذيرات غير الحرجة</label>
            <input className="input-field max-w-md" placeholder="سبب التجاوز" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
            <button className="btn-primary" disabled={blockers > 0} onClick={execute}>تنفيذ الترحيل</button>
            <a className="rounded-lg border border-border bg-white px-3 py-2 text-sm" href={`/admin/academic-seasons/${id}/rollover`}>رجوع</a>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-sm"><thead><tr className="border-b bg-gray-50"><th className="p-3 text-right">الطالب</th><th className="p-3 text-right">الإجراء</th><th className="p-3 text-right">المستوى</th><th className="p-3 text-right">القسم</th><th className="p-3 text-right">الفوج</th><th className="p-3 text-right">تحذيرات/تعارضات</th><th className="p-3 text-right">الحالة</th></tr></thead><tbody>
              {job.items.map((item) => <tr key={item._id} className="border-b"><td className="p-3">{String(item.preview.studentName || "")}</td><td className="p-3">{item.action}</td><td className="p-3">{item.sourceAcademicLevel} ← {item.targetAcademicLevel}</td><td className="p-3">{item.sourceClass} ← {item.targetClass}</td><td className="p-3">{item.sourceGroup} ← {item.targetGroup}</td><td className="p-3">{[...item.conflicts, ...item.warnings].map((c) => c.message).join("، ") || "لا يوجد"}</td><td className="p-3">{item.status}</td></tr>)}
            </tbody></table>
          </div>
        </>
      )}
    </div>
  );
}
