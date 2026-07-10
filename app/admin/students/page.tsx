"use client";

import { useEffect, useMemo, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import StudentTransportSection from "@/components/transport/StudentTransportSection";
import { hasPermission } from "@/lib/permissions";
import { parseApiErrorBody, type ValidationErrorItem } from "@/lib/api-errors";
import type { StudentStatus, UserRole } from "@/types";

type PaymentStatus = "paid" | "partial" | "unpaid";

interface StudentCourse {
  _id: string;
  title: string;
  price: number;
  level?: string;
  enrollmentStatus?: string;
}

interface Student {
  _id: string;
  name: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  wilaya?: string;
  commune?: string;
  studyLevel?: string;
  institution?: string;
  notes?: string;
  status: StudentStatus;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  course?: StudentCourse | null;
  courses?: StudentCourse[];
  totalAmount?: number;
  paidAmount?: number;
  balance?: number;
  paymentStatus?: PaymentStatus;
}

interface CourseOption {
  _id: string;
  title: string;
  level?: string;
  price?: number;
  remainingSeats?: number;
}

interface PaginationMeta {
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

const emptyForm = {
  name: "",
  phone: "",
  password: "",
  gender: "",
  dateOfBirth: "",
  guardianName: "",
  guardianPhone: "",
  address: "",
  wilaya: "",
  commune: "",
  studyLevel: "",
  institution: "",
  notes: "",
  status: "active" as StudentStatus,
  courseId: "",
  enrollmentStatus: "pending",
};

const statusLabels: Record<StudentStatus, string> = {
  active: "نشط",
  inactive: "غير نشط",
  pending: "قيد الانتظار",
};

const paymentLabels: Record<PaymentStatus, string> = {
  paid: "مدفوع",
  partial: "جزئي",
  unpaid: "غير مدفوع",
};

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-DZ").format(new Date(value));
}

function money(value = 0) {
  return new Intl.NumberFormat("ar-DZ").format(value);
}

function statusVariant(status: StudentStatus) {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  return "muted";
}

function paymentVariant(status?: PaymentStatus) {
  if (status === "paid") return "success";
  if (status === "partial") return "warning";
  return "danger";
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [deletedOnly, setDeletedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrorItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedCourse = useMemo(
    () => courses.find((course) => course._id === form.courseId),
    [courses, form.courseId]
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        const role = d.user?.role as UserRole;
        if (role) setCanManage(hasPermission(role, "students.manage"));
      });
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/students/meta")
      .then((res) => res.json())
      .then((data) => {
        if (active) setCourses(data.courses || []);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (courseFilter) params.set("courseId", courseFilter);
      if (paymentFilter) params.set("paymentStatus", paymentFilter);
      if (deletedOnly) params.set("deletedOnly", "true");
      const res = await fetch(`/api/admin/students?${params}`);
      const data = await res.json();
      if (active) {
        setStudents(data.students || []);
        if (data.pagination) setPagination(data.pagination);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, search, statusFilter, courseFilter, paymentFilter, deletedOnly, refreshKey]);

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError("");
    setValidationErrors([]);
  }

  function openCreateForm() {
    setMessage("");
    setSelectedStudent(null);
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(student: Student) {
    setMessage("");
    setSelectedStudent(null);
    setEditingId(student._id);
    setForm({
      name: student.name,
      phone: student.phone || "",
      password: "",
      gender: student.gender || "",
      dateOfBirth: student.dateOfBirth
        ? new Date(student.dateOfBirth).toISOString().slice(0, 10)
        : "",
      guardianName: student.guardianName || "",
      guardianPhone: student.guardianPhone || "",
      address: student.address || "",
      wilaya: student.wilaya || "",
      commune: student.commune || "",
      studyLevel: student.studyLevel || "",
      institution: student.institution || "",
      notes: student.notes || "",
      status: student.status || (student.isActive ? "active" : "inactive"),
      courseId: student.course?._id || "",
      enrollmentStatus: "pending",
    });
    setShowForm(true);
  }

  async function openDetails(student: Student) {
    const res = await fetch(`/api/admin/students/${student._id}`);
    const data = await res.json();
    setSelectedStudent(data.student || student);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setValidationErrors([]);
    const url = editingId ? `/api/admin/students/${editingId}` : "/api/admin/students";
    const method = editingId ? "PUT" : "POST";
    const body = { ...form };
    if (editingId && !body.password) delete (body as { password?: string }).password;
    if (!body.courseId) delete (body as { courseId?: string }).courseId;

    const res = await fetch(url, {
      method,
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
    setMessage(editingId ? "تم تحديث الطالب" : "تمت إضافة الطالب");
    resetForm();
    reload();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/admin/students/${deleteTarget._id}`, { method: "DELETE" });
    setDeleteTarget(null);
    reload();
  }

  async function restore(id: string) {
    await fetch(`/api/admin/students/${id}/restore`, { method: "POST" });
    reload();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Title title="إدارة الطلاب" subtitle="إضافة وتعديل ومتابعة بيانات الطلاب" />
        {canManage && <Button onClick={openCreateForm}>+ إضافة طالب</Button>}
      </div>

      {message && <p className="mb-4 text-sm text-green-600">{message}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          reload();
        }}
        className="mb-6 grid gap-3 md:grid-cols-5"
      >
        <input
          className="input-field"
          placeholder="بحث بالاسم، الهاتف، هاتف الولي، الدورة..."
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
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="pending">قيد الانتظار</option>
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
            <option key={course._id} value={course._id}>
              {course.title}
            </option>
          ))}
        </select>
        <select
          className="input-field"
          value={paymentFilter}
          onChange={(e) => {
            setPaymentFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">كل المدفوعات</option>
          <option value="paid">مدفوع</option>
          <option value="partial">جزئي</option>
          <option value="unpaid">غير مدفوع</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={deletedOnly}
              onChange={(e) => {
                setDeletedOnly(e.target.checked);
                setPage(1);
              }}
            />
            المحذوفون
          </label>
          <button type="submit" className="btn-primary !px-4 !py-2">
            بحث
          </button>
        </div>
      </form>

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-border bg-white p-6">
          <h3 className="mb-4 font-bold">{editingId ? "تعديل طالب" : "إضافة طالب"}</h3>
          <ApiErrorAlert error={error} validationErrors={validationErrors} />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted">الاسم الكامل</label>
              <input className="input-field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">الهاتف</label>
              <input className="input-field" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">
                {editingId ? "كلمة المرور (اختياري)" : "كلمة المرور"}
              </label>
              <input className="input-field" type="password" required={!editingId} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">هاتف الولي</label>
              <input className="input-field" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">تاريخ الميلاد</label>
              <input className="input-field" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">الحالة</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}>
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
                <option value="pending">قيد الانتظار</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">الدورة</label>
              <select className="input-field" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                <option value="">بدون دورة</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">المستوى / القسم</label>
              <input className="input-field" value={form.studyLevel} onChange={(e) => setForm({ ...form, studyLevel: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">الجنس</label>
              <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">اسم الولي</label>
              <input className="input-field" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">الولاية</label>
              <input className="input-field" value={form.wilaya} onChange={(e) => setForm({ ...form, wilaya: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">البلدية</label>
              <input className="input-field" value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">المؤسسة</label>
              <input className="input-field" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted">العنوان</label>
              <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted">ملاحظات</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {selectedCourse && (
              <div className="rounded-2xl border border-border p-3 text-sm">
                <p className="text-muted">الدورة المحددة</p>
                <p className="font-medium">{selectedCourse.title}</p>
                <p className="text-xs text-muted">المبلغ: {money(selectedCourse.price)} | المقاعد: {selectedCourse.remainingSeats ?? "—"}</p>
              </div>
            )}
          </div>
          {editingId && <StudentTransportSection studentId={editingId} />}
          <div className="mt-4 flex gap-2">
            <Button type="submit" loading={saving}>{editingId ? "حفظ" : "إضافة"}</Button>
            <button type="button" onClick={resetForm} className="text-sm text-muted hover:underline">إلغاء</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : students.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="p-3">الطالب</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">هاتف الولي</th>
                  <th className="p-3">الدورة</th>
                  <th className="p-3">المستوى</th>
                  <th className="p-3">التسجيل</th>
                  <th className="p-3">الدفع</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student._id} className="border-b border-border align-top">
                    <td className="p-3">
                      <p className="font-medium">{student.name}</p>
                      <p className="text-xs text-muted">{student.address || "—"}</p>
                    </td>
                    <td className="p-3">{student.phone || "—"}</td>
                    <td className="p-3">{student.guardianPhone || "—"}</td>
                    <td className="p-3">{student.course?.title || "—"}</td>
                    <td className="p-3">{student.studyLevel || student.course?.level || "—"}</td>
                    <td className="p-3">{formatDate(student.createdAt)}</td>
                    <td className="p-3">
                      <Badge variant={paymentVariant(student.paymentStatus)}>
                        {paymentLabels[student.paymentStatus ?? "unpaid"]}
                      </Badge>
                      <p className="mt-1 text-xs text-muted">
                        {money(student.paidAmount)} / {money(student.totalAmount)}
                      </p>
                    </td>
                    <td className="p-3">
                      <Badge variant={student.deletedAt ? "danger" : statusVariant(student.status)}>
                        {student.deletedAt ? "محذوف" : statusLabels[student.status]}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openDetails(student)} className="text-primary hover:underline">عرض</button>
                        {canManage && (
                          <>
                            <button type="button" onClick={() => startEdit(student)} className="text-primary hover:underline">تعديل</button>
                            {!student.deletedAt ? (
                              <button type="button" onClick={() => setDeleteTarget(student)} className="text-red-600 hover:underline">حذف</button>
                            ) : (
                              <button type="button" onClick={() => restore(student._id)} className="text-green-600 hover:underline">استرجاع</button>
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
          <Pagination page={pagination.page} totalPages={pagination.totalPages} hasPrev={pagination.hasPrev} hasNext={pagination.hasNext} onPageChange={setPage} />
        </>
      ) : (
        <p className="text-muted">لا يوجد طلاب</p>
      )}

      <Modal open={Boolean(selectedStudent)} onClose={() => setSelectedStudent(null)} title="ملف الطالب" size="lg">
        {selectedStudent && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-xl font-bold">{selectedStudent.name}</h3>
                <p className="text-muted">{selectedStudent.phone || "—"}</p>
              </div>
              <Badge variant={statusVariant(selectedStudent.status)}>
                {statusLabels[selectedStudent.status]}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <p><span className="text-muted">هاتف الولي:</span> {selectedStudent.guardianPhone || "—"}</p>
              <p><span className="text-muted">تاريخ الميلاد:</span> {formatDate(selectedStudent.dateOfBirth)}</p>
              <p><span className="text-muted">العنوان:</span> {selectedStudent.address || "—"}</p>
              <p><span className="text-muted">المستوى:</span> {selectedStudent.studyLevel || "—"}</p>
              <p><span className="text-muted">تاريخ التسجيل:</span> {formatDate(selectedStudent.createdAt)}</p>
              <p><span className="text-muted">الدفع:</span> {paymentLabels[selectedStudent.paymentStatus ?? "unpaid"]}</p>
            </div>
            <div>
              <h4 className="mb-2 font-bold">الدورات</h4>
              {(selectedStudent.courses ?? []).length > 0 ? (
                <div className="space-y-2">
                  {selectedStudent.courses!.map((course) => (
                    <div key={course._id} className="rounded-2xl border border-border p-3">
                      <p className="font-medium">{course.title}</p>
                      <p className="text-xs text-muted">{course.level || "—"} | {money(course.price)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">لا توجد دورات</p>
              )}
            </div>
            <div>
              <h4 className="mb-2 font-bold">ملاحظات</h4>
              <p className="rounded-2xl border border-border p-3 text-muted">{selectedStudent.notes || "—"}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="حذف الطالب"
        message={`هل تريد حذف ${deleteTarget?.name ?? "هذا الطالب"}؟ سيتم إخفاؤه من القوائم دون حذف بياناته نهائيا.`}
        confirmLabel="حذف"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
