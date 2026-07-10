"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import {
  createStudentInvoiceDocument,
  DocumentActionButtons,
  FinancialDocumentView,
  type FinancialDocumentData,
} from "@/components/finance/documents/FinancialDocument";
import {
  derivePaymentStatus,
  parseLessonDecimal,
  parseSessionCount,
  validateLessonInvoiceInput,
} from "@/lib/lesson-invoice-utils";
import {
  formatCurrency,
  formatDate,
  labelOf,
  LESSON_PAYMENT_STATUSES,
} from "@/lib/finance-labels";

interface Invoice {
  _id: string;
  studentId: string;
  studentName?: string;
  enrollmentId?: string;
  teacherId: string;
  teacherName?: string;
  courseTitle?: string;
  subject: string;
  sessionCount: number;
  pricePerSession: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  invoiceDate: string;
  note?: string;
  createdBy?: string;
}

interface StudentOption {
  _id: string;
  name?: string;
  phone?: string;
}

interface EnrollmentOption {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  adminShare: number;
  teacherShare: number;
}

interface TeacherOption {
  _id: string;
  name?: string;
}

function freshForm() {
  return {
    studentId: "",
    enrollmentId: "",
    sessionCount: "1",
    pricePerSession: "",
    paidAmount: "0",
    invoiceDate: new Date().toISOString().slice(0, 10),
    note: "",
  };
}

export default function LessonInvoicesTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [enrollmentOptions, setEnrollmentOptions] = useState<EnrollmentOption[]>([]);
  const [studentContext, setStudentContext] = useState<EnrollmentOption | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(freshForm);
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [month, setMonth] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewingDocument, setViewingDocument] = useState<FinancialDocumentData | null>(null);

  const sessionCountNum = parseSessionCount(form.sessionCount);
  const priceNum = parseLessonDecimal(form.pricePerSession);
  const paidNum = parseLessonDecimal(form.paidAmount);

  const computedTotal = useMemo(() => {
    if (!sessionCountNum || !Number.isFinite(priceNum) || priceNum <= 0) return 0;
    return sessionCountNum * priceNum;
  }, [sessionCountNum, priceNum]);

  const computedRemaining = useMemo(() => Math.max(0, computedTotal - paidNum), [computedTotal, paidNum]);

  const computedStatus = useMemo(() => {
    if (computedTotal <= 0) return "unpaid";
    return derivePaymentStatus(paidNum, computedTotal);
  }, [computedTotal, paidNum]);

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (teacherFilter) params.set("teacherId", teacherFilter);
      if (statusFilter) params.set("paymentStatus", statusFilter);
      if (month) params.set("month", month);

      const [invRes, sRes, tRes] = await Promise.all([
        fetch(`/api/admin/finance/lesson-invoices?${params}`),
        fetch("/api/admin/students?limit=500"),
        fetch("/api/admin/teachers?limit=500"),
      ]);
      const invData = await invRes.json();
      const sData = await sRes.json();
      const tData = await tRes.json();
      if (active) {
        setInvoices(invData.invoices || []);
        setStudents(sData.students || []);
        setTeachers(tData.teachers || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [search, teacherFilter, statusFilter, month, refreshKey]);

  useEffect(() => {
    if (!form.studentId || !showForm) return;

    let active = true;

    (async () => {
      setContextLoading(true);
      setContextError("");

      try {
        const res = await fetch(
          `/api/admin/finance/lesson-invoices/student-context?studentId=${form.studentId}`
        );
        const data = await res.json();
        if (!active) return;
        if (data.error) {
          setContextError(data.error as string);
          setEnrollmentOptions([]);
          setStudentContext(null);
        } else {
          const options = (data.options as EnrollmentOption[]) || [];
          setEnrollmentOptions(options);
          const selected =
            options.find((o) => o.enrollmentId === form.enrollmentId) ||
            (data.selected as EnrollmentOption) ||
            options[0] ||
            null;
          setStudentContext(selected);
          if (selected && form.enrollmentId !== selected.enrollmentId) {
            setForm((prev) => ({ ...prev, enrollmentId: selected.enrollmentId }));
          }
        }
      } catch {
        if (active) {
          setContextError("تعذّر جلب بيانات تسجيل الطالب");
          setEnrollmentOptions([]);
          setStudentContext(null);
        }
      } finally {
        if (active) setContextLoading(false);
      }
    })();

    return () => {
      active = false;
    };
    // enrollmentId handled via onEnrollmentChange; refetch only when student changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.studentId, showForm]);

  function onEnrollmentChange(enrollmentId: string) {
    const selected = enrollmentOptions.find((o) => o.enrollmentId === enrollmentId) || null;
    setStudentContext(selected);
    setForm((prev) => ({ ...prev, enrollmentId }));
  }

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  function resetForm() {
    setForm(freshForm());
    setEditingId(null);
    setShowForm(false);
    setEnrollmentOptions([]);
    setStudentContext(null);
    setContextError("");
    setError("");
  }

  function openCreate() {
    setEditingId(null);
    setForm(freshForm());
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function openEdit(inv: Invoice) {
    setEditingId(inv._id);
    setForm({
      studentId: inv.studentId,
      enrollmentId: inv.enrollmentId || "",
      sessionCount: String(inv.sessionCount),
      pricePerSession: String(inv.totalAmount / inv.sessionCount),
      paidAmount: String(inv.paidAmount),
      invoiceDate: inv.invoiceDate.slice(0, 10),
      note: inv.note || "",
    });
    setShowForm(true);
    setError("");
    setMessage("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!studentContext) {
      setError(contextError || "يجب اختيار طالب مسجّل في دورة مقبولة");
      return;
    }

    const validationError = validateLessonInvoiceInput({
      studentId: form.studentId,
      sessionCount: sessionCountNum,
      pricePerSession: priceNum,
      paidAmount: paidNum,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const url = editingId
      ? `/api/admin/finance/lesson-invoices/${editingId}`
      : "/api/admin/finance/lesson-invoices";
    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: form.studentId,
        enrollmentId: form.enrollmentId,
        sessionCount: sessionCountNum,
        pricePerSession: priceNum,
        paidAmount: paidNum,
        invoiceDate: form.invoiceDate,
        note: form.note.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError((data.error as string) || "حدث خطأ أثناء الحفظ");
      return;
    }

    setMessage(editingId ? "تم تحديث فاتورة الطالب بنجاح" : "تم حفظ فاتورة الطالب بنجاح");
    resetForm();
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("حذف الفاتورة؟")) return;
    await fetch(`/api/admin/finance/lesson-invoices/${id}`, { method: "DELETE" });
    setMessage("تم حذف الفاتورة");
    reload();
  }

  return (
    <div className="pb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">الحصص والفواتير والمدفوعات</h2>
          <p className="text-sm text-muted">فاتورة طالب — يُستخرج الأستاذ تلقائياً من تسجيل الدورة</p>
        </div>
        {!showForm && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            إضافة فاتورة طالب
          </Button>
        )}
      </div>

      {message && (
        <p className="mb-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {message}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-2xl border border-border bg-white p-5 shadow-sm md:p-6"
        >
          <h3 className="mb-4 text-base font-bold">
            {editingId ? "تعديل فاتورة طالب" : "إنشاء فاتورة طالب"}
          </h3>

          {error && (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">الطالب *</label>
              <select
                className="input-field w-full"
                required
                value={form.studentId}
                onChange={(e) =>
                  setForm({
                    ...freshForm(),
                    studentId: e.target.value,
                    invoiceDate: form.invoiceDate,
                  })
                }
              >
                <option value="">— اختر الطالب —</option>
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} {s.phone ? `(${s.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {enrollmentOptions.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">الدورة *</label>
                <select
                  className="input-field w-full"
                  required
                  value={form.enrollmentId}
                  onChange={(e) => onEnrollmentChange(e.target.value)}
                >
                  {enrollmentOptions.map((o) => (
                    <option key={o.enrollmentId} value={o.enrollmentId}>
                      {o.courseTitle} — {o.teacherName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {contextLoading && form.studentId && (
              <p className="text-sm text-muted md:col-span-2">جاري جلب بيانات التسجيل...</p>
            )}

            {contextError && form.studentId && !contextLoading && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 md:col-span-2">
                {contextError}
              </p>
            )}

            {studentContext && !contextLoading && (
              <>
                <ReadOnlyField label="الدورة" value={studentContext.courseTitle} />
                <ReadOnlyField label="المادة" value={studentContext.subject} />
                <ReadOnlyField label="الأستاذ" value={studentContext.teacherName} />
              </>
            )}

            <Input
              label="عدد الحصص *"
              type="number"
              min={1}
              step={1}
              required
              value={form.sessionCount}
              onChange={(e) => setForm({ ...form, sessionCount: e.target.value })}
            />

            <Input
              label="سعر الحصة (د.ج) *"
              type="text"
              inputMode="decimal"
              min={1}
              step="0.01"
              required
              value={form.pricePerSession}
              onChange={(e) => setForm({ ...form, pricePerSession: e.target.value })}
            />

            <Input
              label="المبلغ المدفوع (د.ج)"
              type="text"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.paidAmount}
              onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
            />

            <Input
              label="تاريخ الفاتورة *"
              type="date"
              required
              value={form.invoiceDate}
              onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
            />

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">ملاحظة</label>
              <textarea
                className="input-field w-full resize-none"
                rows={2}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 rounded-xl bg-pink-50/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryField label="المبلغ الإجمالي" value={formatCurrency(computedTotal)} />
            <SummaryField label="المبلغ المتبقي" value={formatCurrency(computedRemaining)} />
            <SummaryField
              label="حالة الدفع"
              value={labelOf(LESSON_PAYMENT_STATUSES, computedStatus)}
            />
            <SummaryField
              label="عدد الحصص (للحساب)"
              value={sessionCountNum ? String(sessionCountNum) : "—"}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-4">
            <Button type="submit" className="min-w-[140px]" disabled={!studentContext || contextLoading}>
              حفظ الفاتورة
            </Button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted transition hover:bg-pink-50"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Input placeholder="بحث بالطالب..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input-field" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
          <option value="">كل الأساتذة</option>
          {teachers.map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>
        <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل حالات الدفع</option>
          {LESSON_PAYMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <input type="month" className="input-field" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : invoices.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-pink-50/50">
              <tr className="border-b border-border text-right">
                <th className="p-3">الطالب</th>
                <th className="p-3">الأستاذ</th>
                <th className="p-3">الدورة / المادة</th>
                <th className="p-3">عدد الحصص</th>
                <th className="p-3">الإجمالي</th>
                <th className="p-3">المدفوع</th>
                <th className="p-3">المتبقي</th>
                <th className="p-3">حالة الدفع</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv._id} className="border-b border-border hover:bg-pink-50/30">
                  <td className="p-3">{inv.studentName}</td>
                  <td className="p-3">{inv.teacherName}</td>
                  <td className="p-3">
                    {inv.courseTitle || inv.subject}
                  </td>
                  <td className="p-3">{inv.sessionCount}</td>
                  <td className="p-3 font-medium">{formatCurrency(inv.totalAmount)}</td>
                  <td className="p-3">{formatCurrency(inv.paidAmount)}</td>
                  <td className="p-3">{formatCurrency(inv.remainingAmount ?? inv.totalAmount - inv.paidAmount)}</td>
                  <td className="p-3">
                    <span className={`badge ${inv.paymentStatus === "paid" ? "badge-active" : "badge-inactive"}`}>
                      {labelOf(LESSON_PAYMENT_STATUSES, inv.paymentStatus)}
                    </span>
                  </td>
                  <td className="p-3">{formatDate(inv.invoiceDate)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <DocumentActionButtons
                        document={createStudentInvoiceDocument(inv)}
                        onView={setViewingDocument}
                      />
                      <button type="button" onClick={() => openEdit(inv)} className="text-primary hover:underline" title="تعديل">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(inv._id)} className="text-red-600 hover:underline" title="حذف">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="لا توجد فواتير" description="اضغط «إضافة فاتورة طالب» لإنشاء أول فاتورة" />
      )}

      <Modal open={Boolean(viewingDocument)} onClose={() => setViewingDocument(null)} title="عرض المستند" size="lg">
        {viewingDocument && <FinancialDocumentView document={viewingDocument} />}
      </Modal>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input className="input-field w-full bg-muted/20" readOnly value={value} />
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}
