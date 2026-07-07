"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";
import Pagination from "@/components/ui/Pagination";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "students", label: "الطلاب" },
  { id: "teachers", label: "الأساتذة" },
  { id: "courses", label: "الدورات" },
  { id: "enrollments", label: "التسجيلات" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<TabId>("students");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/reports/${tab}?${params}`);
      const data = await res.json();
      if (active) {
        setRows((data[tab] as Record<string, unknown>[]) || []);
        if (data.pagination) setPagination(data.pagination);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [tab, page, search, refreshKey]);

  function exportCsv() {
    const params = new URLSearchParams({ export: "csv" });
    if (search) params.set("search", search);
    window.open(`/api/admin/reports/${tab}?${params}`, "_blank");
  }

  const columns: Record<TabId, { key: string; label: string }[]> = {
    students: [
      { key: "name", label: "الاسم" },
      { key: "phone", label: "الهاتف" },
      { key: "wilaya", label: "الولاية" },
      { key: "studyLevel", label: "المستوى" },
    ],
    teachers: [
      { key: "name", label: "الاسم" },
      { key: "subject", label: "المادة" },
      { key: "phone", label: "الهاتف" },
      { key: "teachingLevel", label: "السنة/المستوى" },
      { key: "adminShare", label: "نسبة الإدارة" },
      { key: "teacherShare", label: "نسبة الأستاذ" },
    ],
    courses: [
      { key: "title", label: "الدورة" },
      { key: "department", label: "القسم" },
      { key: "price", label: "السعر" },
      { key: "remainingSeats", label: "المتبقي" },
    ],
    enrollments: [
      { key: "student", label: "الطالب" },
      { key: "course", label: "الدورة" },
      { key: "status", label: "الحالة" },
      { key: "createdAt", label: "التاريخ" },
    ],
  };

  function cellValue(row: Record<string, unknown>, key: string) {
    const val = row[key];
    if (key === "student" && val && typeof val === "object") {
      return (val as { name?: string }).name ?? "";
    }
    if (key === "course" && val && typeof val === "object") {
      return (val as { title?: string }).title ?? "";
    }
    if (key === "createdAt" && val) {
      return new Date(String(val)).toLocaleDateString("ar-DZ");
    }
    if ((key === "adminShare" || key === "teacherShare") && val !== undefined && val !== null && val !== "") {
      return `${val}%`;
    }
    return String(val ?? "—");
  }

  return (
    <div>
      <Title title="التقارير" subtitle="تقارير الطلاب والأساتذة والدورات والتسجيلات" className="mb-6" />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setPage(1); }}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              tab === t.id ? "bg-primary text-white" : "text-muted hover:bg-muted/10"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <input className="input-field max-w-md" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="button" onClick={() => { setPage(1); setRefreshKey((k) => k + 1); }} className="btn-primary !px-4 !py-2">بحث</button>
        <button type="button" onClick={exportCsv} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted/10">تصدير CSV</button>
      </div>

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : rows.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  {columns[tab].map((c) => (
                    <th key={c.key} className="p-3 font-medium">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border">
                    {columns[tab].map((c) => (
                      <td key={c.key} className="p-3">{cellValue(row, c.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} onPageChange={setPage} />
        </>
      ) : (
        <p className="text-muted">لا توجد بيانات</p>
      )}
    </div>
  );
}
