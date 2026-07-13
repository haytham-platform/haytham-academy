"use client";

import { useEffect, useMemo, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import type {
  TeacherAttendanceRecord,
  TeacherContract,
  TeacherDocument,
  TeacherEmploymentType,
  TeacherMoneyRecord,
  TeacherPerformanceRecord,
  TeacherQualification,
  TeacherSalaryConfig,
  TeacherScheduleItem,
  TeacherStatus,
} from "@/types";
import type { ValidationErrorItem } from "@/lib/api-errors";

interface Teacher {
  _id: string;
  name: string;
  subject: string;
  phone: string;
  teachingLevel: string;
  email?: string;
  address?: string;
  nationalId?: string;
  emergencyPhone?: string;
  hireDate?: string;
  employmentType?: TeacherEmploymentType;
  status: TeacherStatus;
  qualifications: TeacherQualification[];
  subjects: string[];
  academicLevels: string[];
  assignedClasses: string[];
  weeklySchedule: TeacherScheduleItem[];
  attendance: TeacherAttendanceRecord[];
  salaryConfig?: TeacherSalaryConfig;
  salaryHistory: TeacherMoneyRecord[];
  bonuses: TeacherMoneyRecord[];
  deductions: TeacherMoneyRecord[];
  contracts: TeacherContract[];
  documents: TeacherDocument[];
  notes?: string;
  performanceRecords: TeacherPerformanceRecord[];
  adminShare?: number;
  teacherShare?: number;
  isActive: boolean;
}

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

const statusLabels: Record<TeacherStatus, string> = {
  active: "نشط",
  on_leave: "في إجازة",
  suspended: "موقوف",
  resigned: "مستقيل",
};

const statusVariants: Record<TeacherStatus, "success" | "warning" | "danger" | "muted"> = {
  active: "success",
  on_leave: "warning",
  suspended: "danger",
  resigned: "muted",
};

const employmentLabels: Record<TeacherEmploymentType, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  contract: "تعاقد",
  visiting: "زائر",
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  nationalId: "",
  emergencyPhone: "",
  hireDate: "",
  employmentType: "part_time" as TeacherEmploymentType,
  status: "active" as TeacherStatus,
  subject: "",
  teachingLevel: "",
  subjectsText: "",
  academicLevelsText: "",
  assignedClassesText: "",
  qualificationsText: "",
  weeklyScheduleText: "",
  attendanceText: "",
  salaryType: "per_session" as TeacherSalaryConfig["type"],
  baseSalary: "",
  hourlyRate: "",
  sessionRate: "",
  currency: "DZD",
  effectiveFrom: "",
  salaryHistoryText: "",
  bonusesText: "",
  deductionsText: "",
  contractsText: "",
  documentsText: "",
  performanceText: "",
  notes: "",
  adminShare: "",
};

type TeacherForm = typeof emptyForm;

function dateInput(value?: string | Date) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function moneyFromLines(value: string): TeacherMoneyRecord[] {
  return splitLines(value).map((line) => {
    const [title, amount, date, note] = line.split("|").map((part) => part.trim());
    return {
      title,
      amount: Number(amount) || 0,
      date: date || new Date().toISOString(),
      note,
    };
  });
}

function moneyToLines(records: TeacherMoneyRecord[] = []) {
  return records
    .map((row) => [row.title || "", row.amount ?? "", dateInput(row.date), row.note || ""].join(" | "))
    .join("\n");
}

function parseQualifications(value: string): TeacherQualification[] {
  return splitLines(value).map((line) => {
    const [degree, institution, field, year] = line.split("|").map((part) => part.trim());
    return { degree, institution, field, year: year ? Number(year) : undefined };
  });
}

function qualificationsToLines(records: TeacherQualification[] = []) {
  return records
    .map((row) => [row.degree, row.institution || "", row.field || "", row.year || ""].join(" | "))
    .join("\n");
}

function parseSchedule(value: string): TeacherScheduleItem[] {
  return splitLines(value).map((line) => {
    const [day, startTime, endTime, className, subject, room] = line.split("|").map((part) => part.trim());
    return { day, startTime, endTime, className, subject, room };
  });
}

function scheduleToLines(records: TeacherScheduleItem[] = []) {
  return records
    .map((row) => [row.day, row.startTime, row.endTime, row.className || "", row.subject || "", row.room || ""].join(" | "))
    .join("\n");
}

function parseAttendance(value: string): TeacherAttendanceRecord[] {
  return splitLines(value).map((line) => {
    const [date, status, note] = line.split("|").map((part) => part.trim());
    return {
      date: date || new Date().toISOString(),
      status: ["present", "absent", "late", "excused"].includes(status)
        ? (status as TeacherAttendanceRecord["status"])
        : "present",
      note,
    };
  });
}

function attendanceToLines(records: TeacherAttendanceRecord[] = []) {
  return records
    .map((row) => [dateInput(row.date), row.status, row.note || ""].join(" | "))
    .join("\n");
}

function parseDocuments(value: string): TeacherDocument[] {
  return splitLines(value).map((line) => {
    const [title, type, url] = line.split("|").map((part) => part.trim());
    return { title, type: type || "other", url };
  });
}

function documentsToLines(records: TeacherDocument[] = []) {
  return records.map((row) => [row.title, row.type, row.url].join(" | ")).join("\n");
}

function parseContracts(value: string): TeacherContract[] {
  return splitLines(value).map((line) => {
    const [title, type, status, startDate, endDate, url] = line.split("|").map((part) => part.trim());
    return {
      title,
      type: type || "employment",
      status: ["active", "expired", "terminated", "draft"].includes(status)
        ? (status as TeacherContract["status"])
        : "active",
      startDate,
      endDate,
      url,
    };
  });
}

function contractsToLines(records: TeacherContract[] = []) {
  return records
    .map((row) => [row.title, row.type || "", row.status || "active", dateInput(row.startDate), dateInput(row.endDate), row.url || ""].join(" | "))
    .join("\n");
}

function parsePerformance(value: string): TeacherPerformanceRecord[] {
  return splitLines(value).map((line) => {
    const [date, title, rating, note] = line.split("|").map((part) => part.trim());
    return { date: date || new Date().toISOString(), title, rating: rating ? Number(rating) : undefined, note };
  });
}

function performanceToLines(records: TeacherPerformanceRecord[] = []) {
  return records
    .map((row) => [dateInput(row.date), row.title || "", row.rating || "", row.note || ""].join(" | "))
    .join("\n");
}

function teacherToForm(t: Teacher): TeacherForm {
  return {
    name: t.name || "",
    phone: t.phone || "",
    email: t.email || "",
    address: t.address || "",
    nationalId: t.nationalId || "",
    emergencyPhone: t.emergencyPhone || "",
    hireDate: dateInput(t.hireDate),
    employmentType: t.employmentType || "part_time",
    status: t.status || (t.isActive ? "active" : "suspended"),
    subject: t.subject || "",
    teachingLevel: t.teachingLevel || "",
    subjectsText: (t.subjects?.length ? t.subjects : [t.subject]).filter(Boolean).join(", "),
    academicLevelsText: (t.academicLevels?.length ? t.academicLevels : [t.teachingLevel]).filter(Boolean).join(", "),
    assignedClassesText: (t.assignedClasses || []).join(", "),
    qualificationsText: qualificationsToLines(t.qualifications),
    weeklyScheduleText: scheduleToLines(t.weeklySchedule),
    attendanceText: attendanceToLines(t.attendance),
    salaryType: t.salaryConfig?.type || "per_session",
    baseSalary: t.salaryConfig?.baseSalary !== undefined ? String(t.salaryConfig.baseSalary) : "",
    hourlyRate: t.salaryConfig?.hourlyRate !== undefined ? String(t.salaryConfig.hourlyRate) : "",
    sessionRate: t.salaryConfig?.sessionRate !== undefined ? String(t.salaryConfig.sessionRate) : "",
    currency: t.salaryConfig?.currency || "DZD",
    effectiveFrom: dateInput(t.salaryConfig?.effectiveFrom),
    salaryHistoryText: moneyToLines(t.salaryHistory),
    bonusesText: moneyToLines(t.bonuses),
    deductionsText: moneyToLines(t.deductions),
    contractsText: contractsToLines(t.contracts),
    documentsText: documentsToLines(t.documents),
    performanceText: performanceToLines(t.performanceRecords),
    notes: t.notes || "",
    adminShare: t.adminShare !== undefined ? String(t.adminShare) : "",
  };
}

function buildPayload(form: TeacherForm) {
  return {
    name: form.name,
    phone: form.phone,
    email: form.email,
    address: form.address,
    nationalId: form.nationalId,
    emergencyPhone: form.emergencyPhone,
    hireDate: form.hireDate || undefined,
    employmentType: form.employmentType,
    status: form.status,
    subject: form.subject,
    teachingLevel: form.teachingLevel,
    subjects: splitCsv(form.subjectsText || form.subject),
    academicLevels: splitCsv(form.academicLevelsText || form.teachingLevel),
    assignedClasses: splitCsv(form.assignedClassesText),
    qualifications: parseQualifications(form.qualificationsText),
    weeklySchedule: parseSchedule(form.weeklyScheduleText),
    attendance: parseAttendance(form.attendanceText),
    salaryConfig: {
      type: form.salaryType,
      baseSalary: form.baseSalary === "" ? undefined : Number(form.baseSalary),
      hourlyRate: form.hourlyRate === "" ? undefined : Number(form.hourlyRate),
      sessionRate: form.sessionRate === "" ? undefined : Number(form.sessionRate),
      currency: form.currency || "DZD",
      effectiveFrom: form.effectiveFrom || undefined,
    },
    salaryHistory: moneyFromLines(form.salaryHistoryText),
    bonuses: moneyFromLines(form.bonusesText),
    deductions: moneyFromLines(form.deductionsText),
    contracts: parseContracts(form.contractsText),
    documents: parseDocuments(form.documentsText),
    performanceRecords: parsePerformance(form.performanceText),
    notes: form.notes,
    adminShare: form.adminShare === "" ? undefined : Number(form.adminShare),
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted">{label}</label>
      {children}
    </div>
  );
}

function DetailList({ title, rows }: { title: string; rows: React.ReactNode[] }) {
  return (
    <section>
      <h3 className="mb-2 font-bold">{title}</h3>
      {rows.length ? (
        <div className="space-y-2 text-sm">{rows}</div>
      ) : (
        <p className="text-sm text-muted">لا توجد بيانات</p>
      )}
    </section>
  );
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [academicLevelFilter, setAcademicLevelFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<TeacherForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [apiError, setApiError] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [uploadCollection, setUploadCollection] = useState<"documents" | "contracts">("documents");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const computedTeacherShare = useMemo(
    () =>
      form.adminShare !== "" && !Number.isNaN(Number(form.adminShare))
        ? 100 - Number(form.adminShare)
        : null,
    [form.adminShare]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (subjectFilter) params.set("subject", subjectFilter);
      if (academicLevelFilter) params.set("academicLevel", academicLevelFilter);
      if (classFilter) params.set("className", classFilter);
      const res = await fetch(`/api/admin/teachers?${params}`);
      const data = await res.json();
      if (active) {
        setTeachers(data.teachers || []);
        if (data.pagination) setPagination(data.pagination);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, search, statusFilter, subjectFilter, academicLevelFilter, classFilter, refreshKey]);

  function reload() {
    setRefreshKey((key) => key + 1);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setApiError("");
    setValidationErrors([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setApiError("");
    setValidationErrors([]);
    const url = editingId ? `/api/admin/teachers/${editingId}` : "/api/admin/teachers";
    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(form)),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setApiError(data.error || "تعذر حفظ بيانات الأستاذ");
      setValidationErrors(data.validationErrors || []);
      return;
    }
    resetForm();
    reload();
  }

  function startEdit(t: Teacher) {
    setEditingId(t._id);
    setForm(teacherToForm(t));
    setShowForm(true);
    setApiError("");
    setValidationErrors([]);
  }

  async function setTeacherStatus(t: Teacher, status: TeacherStatus) {
    await fetch(`/api/admin/teachers/${t._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("أرشفة الأستاذ؟")) return;
    await fetch(`/api/admin/teachers/${id}`, { method: "DELETE" });
    if (selectedTeacher?._id === id) setSelectedTeacher(null);
    reload();
  }

  async function uploadAttachment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeacher || !uploadFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("title", uploadTitle);
    formData.append("type", uploadType || "other");
    formData.append("collection", uploadCollection);

    const res = await fetch(`/api/admin/teachers/${selectedTeacher._id}/documents`, {
      method: "POST",
      body: formData,
    });
    setUploading(false);
    if (!res.ok) return;
    setUploadTitle("");
    setUploadType("");
    setUploadFile(null);
    setSelectedTeacher(null);
    reload();
  }

  async function deleteAttachment(collection: "documents" | "contracts", item: TeacherDocument | TeacherContract) {
    if (!selectedTeacher) return;
    const params = new URLSearchParams({ collection });
    if (item.publicId) params.set("publicId", item.publicId);
    else if (item.url) params.set("url", item.url);
    else return;
    await fetch(`/api/admin/teachers/${selectedTeacher._id}/documents?${params}`, { method: "DELETE" });
    setSelectedTeacher(null);
    reload();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Title title="إدارة الأساتذة" subtitle="ملفات الأساتذة والتوظيف والجداول والرواتب" />
        <Button onClick={() => { resetForm(); setShowForm(true); }}>+ إضافة أستاذ</Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          reload();
        }}
        className="mb-6 grid gap-2 md:grid-cols-5"
      >
        <input className="input-field" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input className="input-field" placeholder="المادة" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} />
        <input className="input-field" placeholder="المستوى" value={academicLevelFilter} onChange={(e) => setAcademicLevelFilter(e.target.value)} />
        <input className="input-field" placeholder="القسم" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} />
        <button type="submit" className="btn-primary !px-4 !py-2 md:col-span-5">بحث</button>
      </form>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-border p-6">
          <h3 className="mb-4 font-bold">{editingId ? "تعديل أستاذ" : "إضافة أستاذ"}</h3>
          <ApiErrorAlert error={apiError} validationErrors={validationErrors} />

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="الاسم واللقب">
              <input className="input-field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="رقم الهاتف">
              <input className="input-field" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="البريد الإلكتروني">
              <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="المادة الأساسية">
              <input className="input-field" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </Field>
            <Field label="المستوى الأساسي">
              <input className="input-field" required value={form.teachingLevel} onChange={(e) => setForm({ ...form, teachingLevel: e.target.value })} />
            </Field>
            <Field label="الحالة">
              <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TeacherStatus })}>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="نوع التوظيف">
              <select className="input-field" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as TeacherEmploymentType })}>
                {Object.entries(employmentLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="تاريخ التوظيف">
              <input className="input-field" type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
            </Field>
            <Field label="رقم التعريف">
              <input className="input-field" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
            </Field>
            <Field label="هاتف الطوارئ">
              <input className="input-field" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} />
            </Field>
            <Field label="نسبة الإدارة (%)">
              <input className="input-field" type="number" min={0} max={100} value={form.adminShare} onChange={(e) => setForm({ ...form, adminShare: e.target.value })} />
            </Field>
            <Field label="نسبة الأستاذ">
              <input className="input-field bg-muted/30" readOnly value={computedTeacherShare !== null ? `${computedTeacherShare}%` : "-"} />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="العنوان">
              <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="المواد، مفصولة بفواصل">
              <input className="input-field" value={form.subjectsText} onChange={(e) => setForm({ ...form, subjectsText: e.target.value })} />
            </Field>
            <Field label="المستويات الأكاديمية، مفصولة بفواصل">
              <input className="input-field" value={form.academicLevelsText} onChange={(e) => setForm({ ...form, academicLevelsText: e.target.value })} />
            </Field>
            <Field label="الأقسام المسندة، مفصولة بفواصل">
              <input className="input-field" value={form.assignedClassesText} onChange={(e) => setForm({ ...form, assignedClassesText: e.target.value })} />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <Field label="نوع الراتب">
              <select className="input-field" value={form.salaryType} onChange={(e) => setForm({ ...form, salaryType: e.target.value as TeacherSalaryConfig["type"] })}>
                <option value="fixed">ثابت</option>
                <option value="hourly">بالساعة</option>
                <option value="per_session">بالحصة</option>
              </select>
            </Field>
            <Field label="راتب ثابت">
              <input className="input-field" type="number" min={0} value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} />
            </Field>
            <Field label="سعر الساعة">
              <input className="input-field" type="number" min={0} value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
            </Field>
            <Field label="سعر الحصة">
              <input className="input-field" type="number" min={0} value={form.sessionRate} onChange={(e) => setForm({ ...form, sessionRate: e.target.value })} />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="المؤهلات: الدرجة | المؤسسة | التخصص | السنة">
              <textarea className="input-field min-h-24" value={form.qualificationsText} onChange={(e) => setForm({ ...form, qualificationsText: e.target.value })} />
            </Field>
            <Field label="الجدول الأسبوعي: اليوم | البداية | النهاية | القسم | المادة | القاعة">
              <textarea className="input-field min-h-24" value={form.weeklyScheduleText} onChange={(e) => setForm({ ...form, weeklyScheduleText: e.target.value })} />
            </Field>
            <Field label="الحضور: التاريخ | present/absent/late/excused | ملاحظة">
              <textarea className="input-field min-h-24" value={form.attendanceText} onChange={(e) => setForm({ ...form, attendanceText: e.target.value })} />
            </Field>
            <Field label="سجل الراتب: العنوان | المبلغ | التاريخ | ملاحظة">
              <textarea className="input-field min-h-24" value={form.salaryHistoryText} onChange={(e) => setForm({ ...form, salaryHistoryText: e.target.value })} />
            </Field>
            <Field label="المكافآت: العنوان | المبلغ | التاريخ | ملاحظة">
              <textarea className="input-field min-h-24" value={form.bonusesText} onChange={(e) => setForm({ ...form, bonusesText: e.target.value })} />
            </Field>
            <Field label="الاقتطاعات: العنوان | المبلغ | التاريخ | ملاحظة">
              <textarea className="input-field min-h-24" value={form.deductionsText} onChange={(e) => setForm({ ...form, deductionsText: e.target.value })} />
            </Field>
            <Field label="العقود: العنوان | النوع | الحالة | البداية | النهاية | الرابط">
              <textarea className="input-field min-h-24" value={form.contractsText} onChange={(e) => setForm({ ...form, contractsText: e.target.value })} />
            </Field>
            <Field label="الوثائق: العنوان | النوع | الرابط">
              <textarea className="input-field min-h-24" value={form.documentsText} onChange={(e) => setForm({ ...form, documentsText: e.target.value })} />
            </Field>
            <Field label="الأداء: التاريخ | العنوان | التقييم | الملاحظة">
              <textarea className="input-field min-h-24" value={form.performanceText} onChange={(e) => setForm({ ...form, performanceText: e.target.value })} />
            </Field>
            <Field label="ملاحظات">
              <textarea className="input-field min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>

          <div className="mt-4 flex gap-2">
            <Button type="submit" loading={submitting}>حفظ</Button>
            <button type="button" onClick={resetForm} className="text-sm text-muted">إلغاء</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : teachers.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="p-3">الاسم</th>
                  <th className="p-3">المواد</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">المستويات</th>
                  <th className="p-3">الأقسام</th>
                  <th className="p-3">التوظيف</th>
                  <th className="p-3">نسبة الإدارة</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t._id} className="border-b border-border">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3">{(t.subjects?.length ? t.subjects : [t.subject]).join(", ")}</td>
                    <td className="p-3">{t.phone}</td>
                    <td className="p-3">{(t.academicLevels?.length ? t.academicLevels : [t.teachingLevel]).join(", ")}</td>
                    <td className="p-3">{t.assignedClasses?.join(", ") || "-"}</td>
                    <td className="p-3">{employmentLabels[t.employmentType || "part_time"]}</td>
                    <td className="p-3">{t.adminShare !== undefined ? `${t.adminShare}%` : "-"}</td>
                    <td className="p-3">
                      <Badge variant={statusVariants[t.status || "suspended"]}>{statusLabels[t.status || "suspended"]}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setSelectedTeacher(t)} className="text-secondary hover:underline">تفاصيل</button>
                        <button type="button" onClick={() => startEdit(t)} className="text-primary hover:underline">تعديل</button>
                        <button type="button" onClick={() => setTeacherStatus(t, t.status === "active" ? "suspended" : "active")} className="text-amber-600 hover:underline">
                          {t.status === "active" ? "إيقاف" : "تفعيل"}
                        </button>
                        <button type="button" onClick={() => handleDelete(t._id)} className="text-red-600 hover:underline">أرشفة</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} onPageChange={setPage} />
        </>
      ) : (
        <p className="text-muted">لا يوجد أساتذة</p>
      )}

      <Modal open={Boolean(selectedTeacher)} onClose={() => setSelectedTeacher(null)} title={selectedTeacher?.name || "تفاصيل الأستاذ"} size="lg">
        {selectedTeacher && (
          <div className="max-h-[calc(100vh-10rem)] space-y-5 overflow-y-auto px-1 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <p><span className="text-muted">الهاتف:</span> {selectedTeacher.phone}</p>
              <p><span className="text-muted">البريد:</span> {selectedTeacher.email || "-"}</p>
              <p><span className="text-muted">الحالة:</span> {statusLabels[selectedTeacher.status]}</p>
              <p><span className="text-muted">التوظيف:</span> {employmentLabels[selectedTeacher.employmentType || "part_time"]}</p>
              <p><span className="text-muted">تاريخ التوظيف:</span> {dateInput(selectedTeacher.hireDate) || "-"}</p>
              <p><span className="text-muted">هاتف الطوارئ:</span> {selectedTeacher.emergencyPhone || "-"}</p>
              <p className="md:col-span-2"><span className="text-muted">العنوان:</span> {selectedTeacher.address || "-"}</p>
            </div>

            <DetailList
              title="المواد والمستويات"
              rows={[
                <p key="subjects">المواد: {(selectedTeacher.subjects?.length ? selectedTeacher.subjects : [selectedTeacher.subject]).join(", ")}</p>,
                <p key="levels">المستويات: {(selectedTeacher.academicLevels?.length ? selectedTeacher.academicLevels : [selectedTeacher.teachingLevel]).join(", ")}</p>,
                <p key="classes">الأقسام: {selectedTeacher.assignedClasses?.join(", ") || "-"}</p>,
              ]}
            />
            <DetailList
              title="المؤهلات"
              rows={(selectedTeacher.qualifications || []).map((q, index) => (
                <p key={`${q.degree}-${index}`}>{q.degree} - {q.institution || "-"} - {q.field || "-"} {q.year ? `(${q.year})` : ""}</p>
              ))}
            />
            <DetailList
              title="الجدول الأسبوعي"
              rows={(selectedTeacher.weeklySchedule || []).map((s, index) => (
                <p key={`${s.day}-${index}`}>{s.day}: {s.startTime} - {s.endTime} / {s.className || "-"} / {s.subject || "-"}</p>
              ))}
            />
            <DetailList
              title="الراتب"
              rows={[
                <p key="config">النوع: {selectedTeacher.salaryConfig?.type || "per_session"} / ثابت: {selectedTeacher.salaryConfig?.baseSalary ?? "-"} / الساعة: {selectedTeacher.salaryConfig?.hourlyRate ?? "-"} / الحصة: {selectedTeacher.salaryConfig?.sessionRate ?? "-"}</p>,
                ...((selectedTeacher.salaryHistory || []).map((row, index) => (
                  <p key={`salary-${index}`}>{row.title || "سجل"}: {row.amount} {selectedTeacher.salaryConfig?.currency || "DZD"} - {dateInput(row.date)}</p>
                ))),
              ]}
            />
            <DetailList
              title="المكافآت والاقتطاعات"
              rows={[
                ...((selectedTeacher.bonuses || []).map((row, index) => <p key={`bonus-${index}`}>مكافأة: {row.title || "-"} / {row.amount}</p>)),
                ...((selectedTeacher.deductions || []).map((row, index) => <p key={`deduction-${index}`}>اقتطاع: {row.title || "-"} / {row.amount}</p>)),
              ]}
            />
            <DetailList
              title="الحضور والأداء"
              rows={[
                ...((selectedTeacher.attendance || []).slice(-10).map((row, index) => <p key={`att-${index}`}>{dateInput(row.date)} - {row.status} - {row.note || ""}</p>)),
                ...((selectedTeacher.performanceRecords || []).map((row, index) => <p key={`perf-${index}`}>{dateInput(row.date)} - {row.title || "-"} - {row.rating || "-"} - {row.note || ""}</p>)),
              ]}
            />

            <section>
              <h3 className="mb-2 font-bold">الوثائق والعقود</h3>
              <div className="space-y-2">
                {(selectedTeacher.documents || []).map((doc, index) => (
                  <div key={`${doc.url}-${index}`} className="flex items-center justify-between rounded-xl border border-border p-2">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{doc.title}</a>
                    <button type="button" className="text-red-600 hover:underline" onClick={() => deleteAttachment("documents", doc)}>حذف</button>
                  </div>
                ))}
                {(selectedTeacher.contracts || []).map((contract, index) => (
                  <div key={`${contract.url}-${index}`} className="flex items-center justify-between rounded-xl border border-border p-2">
                    {contract.url ? (
                      <a href={contract.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{contract.title}</a>
                    ) : (
                      <span>{contract.title}</span>
                    )}
                    {contract.url && <button type="button" className="text-red-600 hover:underline" onClick={() => deleteAttachment("contracts", contract)}>حذف</button>}
                  </div>
                ))}
              </div>

              <form onSubmit={uploadAttachment} className="mt-3 grid gap-2 md:grid-cols-2">
                <select className="input-field" value={uploadCollection} onChange={(e) => setUploadCollection(e.target.value as "documents" | "contracts")}>
                  <option value="documents">وثيقة</option>
                  <option value="contracts">عقد</option>
                </select>
                <input className="input-field" placeholder="العنوان" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} required />
                <input className="input-field" placeholder="النوع" value={uploadType} onChange={(e) => setUploadType(e.target.value)} />
                <input className="input-field" type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} required />
                <Button type="submit" loading={uploading} className="md:col-span-2">رفع</Button>
              </form>
            </section>

            <section>
              <h3 className="mb-2 font-bold">ملاحظات</h3>
              <p className="leading-7 text-muted">{selectedTeacher.notes || "لا توجد ملاحظات"}</p>
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
