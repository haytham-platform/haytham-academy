"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Title from "@/components/ui/Title";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";

interface Season { _id: string; name: string; code: string; status: string; startDate: string; endDate: string; isCurrent: boolean; isOpenForRegistration: boolean; description?: string; notes?: string; closedAt?: string; archivedAt?: string }

export default function AcademicSeasonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [season, setSeason] = useState<Season | null>(null);
  const [error, setError] = useState("");
  async function load() {
    const res = await fetch(`/api/admin/academic-seasons/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "تعذر تحميل الموسم");
    else setSeason(data.season);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [id]);
  async function transition(action: string) {
    const reason = action === "archive" ? prompt("سبب الأرشفة") || "" : "";
    const res = await fetch(`/api/admin/academic-seasons/${id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transition: action, reason, isOpenForRegistration: true }) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "تعذر تنفيذ العملية");
      return;
    }
    await load();
  }
  return (
    <div dir="rtl">
      <Title title={season?.name || "الموسم الدراسي"} subtitle={season?.code || ""} className="mb-6" />
      {error && <ApiErrorAlert error={error} />}
      {season && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-border bg-white p-5 md:grid-cols-4">
            <div><p className="text-xs text-muted">الحالة</p><strong>{season.status}</strong></div>
            <div><p className="text-xs text-muted">الحالي</p><strong>{season.isCurrent ? "نعم" : "لا"}</strong></div>
            <div><p className="text-xs text-muted">التسجيل</p><strong>{season.isOpenForRegistration ? "مفتوح" : "مغلق"}</strong></div>
            <div><p className="text-xs text-muted">المدة</p><strong>{new Date(season.startDate).toLocaleDateString("ar-DZ")} - {new Date(season.endDate).toLocaleDateString("ar-DZ")}</strong></div>
          </div>
          <div className="rounded-lg border border-border bg-white p-5">
            <p className="text-sm text-muted">{season.description || "لا يوجد وصف"}</p>
            <p className="mt-2 text-sm">{season.notes || ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/academic-seasons/${id}/edit`} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">تعديل</Link>
            <Link href={`/admin/academic-seasons/${id}/rollover`} className="btn-primary">بدء الترحيل</Link>
            <button className="rounded-lg border border-border bg-white px-3 py-2 text-sm" onClick={() => transition("activate")}>تفعيل</button>
            <button className="rounded-lg border border-border bg-white px-3 py-2 text-sm" onClick={() => transition("close")}>إغلاق</button>
            <button className="rounded-lg border border-border bg-white px-3 py-2 text-sm" onClick={() => transition("reopen")}>إعادة فتح</button>
            <button className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700" onClick={() => transition("archive")}>أرشفة</button>
            <button className="rounded-lg border border-border bg-white px-3 py-2 text-sm" onClick={() => transition("restore")}>استعادة</button>
          </div>
        </div>
      )}
    </div>
  );
}
