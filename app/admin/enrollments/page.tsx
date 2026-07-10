"use client";

import { useEffect, useMemo, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import StatusBadge from "@/components/ui/StatusBadge";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import { hasPermission } from "@/lib/permissions";
import { parseApiErrorBody, type ValidationErrorItem } from "@/lib/api-errors";
import type { EnrollmentStatus, UserRole } from "@/types";

interface EnrollmentPerson {
  name?: string;
  phone?: string;
  role?: string;
}

interface EnrollmentCourse {
  _id?: string;
  title?: string;
  level?: string;
  remainingSeats?: number;
  teacher?: { name?: string };
}

interface Enrollment {
  _id: string;
  student: EnrollmentPerson;
  course: EnrollmentCourse;
  status: EnrollmentStatus;
  note: string;
  createdBy?: EnrollmentPerson;
  createdAt: string;
  updatedAt?: string;
}

interface MetaStudent {
  _id: string;
  name: string;
  phone?: string;
}

interface MetaCourse {
  _id: string;
  title: string;
  level?: string;
  remainingSeats: number;
  seats: number;
}

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

const emptyForm = {
  studentId: "",
  courseId: "",
  status: "pending" as EnrollmentStatus,
  note: "",
};

const statusOptions: { value: EnrollmentStatus; label: string }[] = [
  { value: "pending", label: "قيد المراجعة" },
  { value: "approved", label: "مقبول" },
  { value: "rejected", label: "مرفوض" },
  { value: "cancelled", label: "ملغى" },
];

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function actionLabel(status: EnrollmentStatus) {
  if (status === "approved") return "قبول التسجيل";
  if (status === "rejected") return "رفض التسجيل";
  return "إلغاء التسجيل";
}

export default function AdminEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [students, setStudents] = useState<MetaStudent[]>([]);
  const [courses, setCourses] = useState<MetaCourse[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    enrollment: Enrollment;
    status: EnrollmentStatus;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedCourse = useMemo(
    () => courses.find((course) => course._id === form.courseId),
    [courses, form.courseId]
  );

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const role = d.user?.role as UserRole;
        if (role) setCanManage(hasPermission(role, "enrollments.manage"));
      });
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/enrollments/meta")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setStudents(data.students || []);
        setCourses(data.courses || []);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (statusFilter) params.set("status", statusFilter);
      if (courseFilter) params.set("courseId", courseFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/enrollments?${params}`);
      const data = await res.json();
      if (active) {
        setEnrollments(data.enrollments || []);
        if (data.pagination) setPagination(data.pagination);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, statusFilter, courseFilter, search, refreshKey]);

  function openCreateForm() {
    setEditingEnrollment(null);
    setForm(emptyForm);
    setError("");
    setValidationErrors([]);
    setShowForm(true);
  }

  function openEdit(enrollment: Enrollment) {
    setEditingEnrollment(enrollment);
    setForm({
      studentId: "",
      courseId: "",
      status: enrollment.status,
      note: enrollment.note || "",
    });
    setError("");
    setValidationErrors([]);
    setShowForm(true);
  }

  async function openDetails(enrollment: Enrollment) {
    const res = await fetch(`/api/admin/enrollments/${enrollment._id}`);
    const data = await res.json();
    setSelectedEnrollment(data.enrollment || enrollment);
  }

  async function submitEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setValidationErrors([]);

    const url = editingEnrollment
      ? `/api/admin/enrollments/${editingEnrollment._id}`
      : "/api/admin/enrollments";
    const body = editingEnrollment
      ? { status: form.status, note: form.note }
      : form;

    const res = await fetch(url, {
      method: editingEnrollment ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      const parsed = parseApiErrorBody(data);
      setError(parsed.message);
      setValidationErrors(parsed.validationErrors ?? []);
      return;
    }

    setMessage(editingEnrollment ? "تم تحديث التسجيل" : "تم إنشاء التسجيل");
    setShowForm(false);
    setForm(emptyForm);
    setEditingEnrollment(null);
    reload();
  }

  async function updateStatus(enrollment: Enrollment, status: EnrollmentStatus) {
    const res = await fetch(`/api/admin/enrollments/${enrollment._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      const parsed = parseApiErrorBody(data);
      setError(parsed.message);
      return;
    }
    setMessage("تم تحديث حالة التسجيل");
    setConfirmAction(null);
    reload();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Title title="إدارة التسجيلات" subtitle="تسجيل الطلاب في الدورات ومتابعة حالات القبول" />
        {canManage && <Button onClick={openCreateForm}>+ تسجيل جديد</Button>}
      </div>

      {message && <p className="mb-4 text-sm text-green-600">{message}</p>}
      {error && !showForm && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          reload();
        }}
        className="mb-6 grid gap-3 md:grid-cols-4"
      >
        <input
          className="input-field"
          placeholder="بحث بالطالب، الهاتف، الدورة..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input-field"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">كل الحالات</option>
          {statusOptions.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
        <select
          className="input-field"
          value={courseFilter}
          onChange={(e) => {
            setCourseFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">كل الدورات</option>
          {courses.map((course) => (
            <option key={course._id} value={course._id}>{course.title}</option>
          ))}
        </select>
        <button type="submit" className="btn-primary !px-4 !py-2">بحث</button>
      </form>

      {showForm && canManage && (
        <form onSubmit={submitEnrollment} className="mb-8 rounded-2xl border border-border bg-white p-6">
          <h3 className="mb-4 font-bold">{editingEnrollment ? "تعديل التسجيل" : "تسجيل طالب في دورة"}</h3>
          <ApiErrorAlert error={error} validationErrors={validationErrors} />
          <div className="grid gap-3 md:grid-cols-3">
            {!editingEnrollment && (
              <>
                <select
                  className="input-field"
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  required
                >
                  <option value="">اختر الطالب</option>
                  {students.map((student) => (
                    <option key={student._id} value={student._id}>
                      {student.name} - {student.phone}
                    </option>
                  ))}
                </select>
                <select
                  className="input-field"
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  required
                >
                  <option value="">اختر الدورة</option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.title} ({course.remainingSeats} مقعد)
                    </option>
                  ))}
                </select>
              </>
            )}
            <select
              className="input-field"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as EnrollmentStatus })}
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs text-muted">ملاحظة</label>
              <textarea
                className="input-field"
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            {selectedCourse && (
              <div className="rounded-2xl border border-border p-3 text-sm">
                <p className="font-medium">{selectedCourse.title}</p>
                <p className="text-xs text-muted">
                  {selectedCourse.level || "—"} | المقاعد المتبقية: {selectedCourse.remainingSeats}
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" loading={saving}>{editingEnrollment ? "حفظ" : "تسجيل"}</Button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingEnrollment(null);
                setForm(emptyForm);
              }}
              className="text-sm text-muted hover:underline"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : enrollments.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="p-3">الطالب</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">الدورة</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">ملاحظة</th>
                  <th className="p-3">أنشئ بواسطة</th>
                  <th className="p-3">تاريخ التسجيل</th>
                  <th className="p-3">آخر تحديث</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => (
                  <tr key={enrollment._id} className="border-b border-border align-top">
                    <td className="p-3">{enrollment.student?.name || "—"}</td>
                    <td className="p-3">{enrollment.student?.phone || "—"}</td>
                    <td className="p-3">
                      <p>{enrollment.course?.title || "—"}</p>
                      <p className="text-xs text-muted">{enrollment.course?.teacher?.name || ""}</p>
                    </td>
                    <td className="p-3"><StatusBadge status={enrollment.status} /></td>
                    <td className="max-w-[220px] p-3 text-muted">
                      <span className="line-clamp-2">{enrollment.note || "—"}</span>
                    </td>
                    <td className="p-3">{enrollment.createdBy?.name || "—"}</td>
                    <td className="p-3">{formatDate(enrollment.createdAt)}</td>
                    <td className="p-3">{formatDate(enrollment.updatedAt)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openDetails(enrollment)} className="text-primary hover:underline">عرض</button>
                        {canManage && (
                          <>
                            <button type="button" onClick={() => openEdit(enrollment)} className="text-primary hover:underline">تعديل</button>
                            {enrollment.status === "pending" && (
                              <>
                                <button type="button" onClick={() => setConfirmAction({ enrollment, status: "approved" })} className="text-green-600 hover:underline">قبول</button>
                                <button type="button" onClick={() => setConfirmAction({ enrollment, status: "rejected" })} className="text-red-600 hover:underline">رفض</button>
                              </>
                            )}
                            {(enrollment.status === "pending" || enrollment.status === "approved") && (
                              <button type="button" onClick={() => setConfirmAction({ enrollment, status: "cancelled" })} className="text-amber-600 hover:underline">إلغاء</button>
                            )}
                          </>
                        )}
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
        <p className="text-muted">لا توجد تسجيلات</p>
      )}

      <Modal open={Boolean(selectedEnrollment)} onClose={() => setSelectedEnrollment(null)} title="تفاصيل التسجيل" size="lg">
        {selectedEnrollment && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold">{selectedEnrollment.student?.name || "—"}</h3>
                <p className="text-muted">{selectedEnrollment.student?.phone || "—"}</p>
              </div>
              <StatusBadge status={selectedEnrollment.status} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <p><span className="text-muted">الدورة:</span> {selectedEnrollment.course?.title || "—"}</p>
              <p><span className="text-muted">الأستاذ:</span> {selectedEnrollment.course?.teacher?.name || "—"}</p>
              <p><span className="text-muted">أنشئ بواسطة:</span> {selectedEnrollment.createdBy?.name || "—"}</p>
              <p><span className="text-muted">تاريخ التسجيل:</span> {formatDate(selectedEnrollment.createdAt)}</p>
              <p><span className="text-muted">آخر تحديث:</span> {formatDate(selectedEnrollment.updatedAt)}</p>
            </div>
            <div>
              <h4 className="mb-2 font-bold">الملاحظة</h4>
              <p className="rounded-2xl border border-border p-3 text-muted">{selectedEnrollment.note || "—"}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmAction ? actionLabel(confirmAction.status) : ""}
        message={`هل تريد تنفيذ هذا الإجراء على تسجيل ${confirmAction?.enrollment.student?.name ?? "الطالب"}؟`}
        confirmLabel={confirmAction ? actionLabel(confirmAction.status) : "تأكيد"}
        onConfirm={() => {
          if (confirmAction) updateStatus(confirmAction.enrollment, confirmAction.status);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
