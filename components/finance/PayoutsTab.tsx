"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, CreditCard, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import {
  createTeacherInvoiceDocument,
  DocumentActionButtons,
  FinancialDocumentView,
  type FinancialDocumentData,
} from "@/components/finance/documents/FinancialDocument";
import {
  formatCurrency,
  formatDate,
  labelOf,
  LESSON_PAYMENT_STATUSES,
  PAYMENT_METHODS,
  PAYOUT_TYPES,
} from "@/lib/finance-labels";
import { decimalsSumTo100, parseDecimal, round2 } from "@/lib/decimal";

interface Payout {
  _id: string;
  teacherId: string;
  teacherName?: string;
  courseId?: string;
  courseTitle?: string;
  recordType?: string;
  academicSeason?: string;
  invoicePeriod?: string;
  numberOfSessions: number;
  extraSessions: number;
  sessionRate: number;
  grossAmount?: number;
  administrationPercentage?: number;
  teacherPercentage?: number;
  administrationShare?: number;
  teacherShareAmount?: number;
  deductions?: number;
  netTeacherAmount?: number;
  manualAdjustment: number;
  totalDue: number;
  paid: number;
  remaining: number;
  amount: number;
  payoutType: string;
  payoutDate: string;
  paymentDate?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  invoiceStatus?: string;
  status: string;
  note?: string;
  createdBy?: string;
}

interface TeacherOption {
  _id: string;
  name?: string;
  subject?: string;
  adminShare?: number;
  teacherShare?: number;
}

interface CourseOption {
  _id: string;
  title?: string;
}

type FormMode = "payout" | "teacher_invoice";

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

function emptyPayoutForm() {
  return {
    teacherId: "",
    courseId: "",
    numberOfSessions: "0",
    extraSessions: "0",
    sessionRate: "0",
    manualAdjustment: "0",
    totalDue: "0",
    paid: "0",
    payoutType: "fixed",
    payoutDate: today(),
    note: "",
  };
}

function emptyInvoiceForm() {
  return {
    teacherId: "",
    courseId: "",
    academicSeason: "",
    invoicePeriod: currentMonth(),
    numberOfSessions: "1",
    sessionRate: "0",
    administrationPercentage: "0",
    teacherPercentage: "100",
    deductions: "0",
    totalDue: "",
    paid: "0",
    paymentDate: today(),
    paymentMethod: "cash",
    note: "",
  };
}

export default function PayoutsTab() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<FormMode>("payout");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payoutForm, setPayoutForm] = useState(emptyPayoutForm);
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoiceForm);
  const [teacherFilter, setTeacherFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<Payout | null>(null);
  const [paymentFor, setPaymentFor] = useState<Payout | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentAccountType, setPaymentAccountType] = useState("cash");
  const [paymentAccountName, setPaymentAccountName] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<FinancialDocumentData | null>(null);

  const selectedTeacher = teachers.find((t) => t._id === invoiceForm.teacherId);
  const completedSessions = parseDecimal(invoiceForm.numberOfSessions);
  const sessionRate = parseDecimal(invoiceForm.sessionRate);
  const grossAmount = round2(completedSessions * sessionRate);
  const administrationPercentage = parseDecimal(invoiceForm.administrationPercentage);
  const teacherPercentage = parseDecimal(invoiceForm.teacherPercentage);
  const deductions = parseDecimal(invoiceForm.deductions);
  const administrationShare = useMemo(
    () => round2((grossAmount * administrationPercentage) / 100),
    [grossAmount, administrationPercentage]
  );
  const teacherShareAmount = useMemo(
    () => round2((grossAmount * teacherPercentage) / 100),
    [grossAmount, teacherPercentage]
  );
  const netTeacherAmount = useMemo(
    () => round2(Math.max(0, teacherShareAmount - deductions)),
    [teacherShareAmount, deductions]
  );
  const invoiceTotalDue = invoiceForm.totalDue === "" ? netTeacherAmount : parseDecimal(invoiceForm.totalDue);
  const invoicePaid = parseDecimal(invoiceForm.paid);
  const invoiceRemaining = round2(Math.max(0, invoiceTotalDue - invoicePaid));
  const invoicePaymentStatus =
    invoicePaid <= 0 ? "unpaid" : invoiceRemaining <= 0 ? "paid" : "partial";

  async function loadPayouts() {
    setLoading(true);
    const params = new URLSearchParams();
    if (teacherFilter) params.set("teacherId", teacherFilter);
    if (courseFilter) params.set("courseId", courseFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/admin/finance/teacher-payouts?${params}`);
    const data = await res.json();
    setPayouts(data.payouts || []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams();
      if (teacherFilter) params.set("teacherId", teacherFilter);
      if (courseFilter) params.set("courseId", courseFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const [pRes, tRes, cRes] = await Promise.all([
        fetch(`/api/admin/finance/teacher-payouts?${params}`),
        fetch("/api/admin/teachers?limit=500"),
        fetch("/api/admin/courses?limit=500"),
      ]);
      const pData = await pRes.json();
      const tData = await tRes.json();
      const cData = await cRes.json();
      if (active) {
        setPayouts(pData.payouts || []);
        setTeachers(tData.teachers || []);
        setCourses(cData.courses || []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [teacherFilter, courseFilter, statusFilter, from, to]);

  function openPayoutCreate() {
    setMode("payout");
    setEditingId(null);
    setPayoutForm(emptyPayoutForm());
    setError("");
    setModalOpen(true);
  }

  function openInvoiceCreate() {
    setMode("teacher_invoice");
    setEditingId(null);
    setInvoiceForm(emptyInvoiceForm());
    setError("");
    setModalOpen(true);
  }

  function openEdit(p: Payout) {
    setEditingId(p._id);
    setError("");
    if (p.recordType === "teacher_invoice") {
      setMode("teacher_invoice");
      setInvoiceForm({
        teacherId: p.teacherId,
        courseId: p.courseId || "",
        academicSeason: p.academicSeason || "",
        invoicePeriod: p.invoicePeriod || p.payoutDate.slice(0, 7),
        numberOfSessions: String(p.numberOfSessions || 0),
        sessionRate: String(p.sessionRate || 0),
        administrationPercentage: String(p.administrationPercentage || 0),
        teacherPercentage: String(p.teacherPercentage || 0),
        deductions: String(p.deductions || 0),
        totalDue: String(p.totalDue || 0),
        paid: String(p.paid || 0),
        paymentDate: p.paymentDate ? p.paymentDate.slice(0, 10) : today(),
        paymentMethod: p.paymentMethod || "cash",
        note: p.note || "",
      });
    } else {
      setMode("payout");
      setPayoutForm({
        teacherId: p.teacherId,
        courseId: p.courseId || "",
        numberOfSessions: String(p.numberOfSessions || 0),
        extraSessions: String(p.extraSessions || 0),
        sessionRate: String(p.sessionRate || 0),
        manualAdjustment: String(p.manualAdjustment || 0),
        totalDue: String(p.totalDue || p.amount),
        paid: String(p.paid ?? p.amount),
        payoutType: p.payoutType,
        payoutDate: p.payoutDate.slice(0, 10),
        note: p.note || "",
      });
    }
    setModalOpen(true);
  }

  function onInvoiceTeacherChange(teacherId: string) {
    const teacher = teachers.find((t) => t._id === teacherId);
    const adminShare = parseDecimal(teacher?.adminShare ?? 0);
    setInvoiceForm({
      ...invoiceForm,
      teacherId,
      administrationPercentage: String(adminShare),
      teacherPercentage: String(Math.max(0, 100 - adminShare)),
      totalDue: "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const isInvoice = mode === "teacher_invoice";
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const invoiceAction = submitter?.value === "approve" ? "approve" : "save";
    if (isInvoice && !decimalsSumTo100(teacherPercentage, administrationPercentage)) {
      setError("يجب أن يكون مجموع نسبة الأستاذ ونسبة الإدارة 100%");
      return;
    }
    const body = isInvoice
      ? {
          recordType: "teacher_invoice",
          teacherId: invoiceForm.teacherId,
          courseId: invoiceForm.courseId,
          academicSeason: invoiceForm.academicSeason,
          invoicePeriod: invoiceForm.invoicePeriod,
          numberOfSessions: completedSessions,
          sessionRate,
          administrationPercentage,
          teacherPercentage,
          deductions,
          totalDue: round2(invoiceTotalDue),
          paid: round2(invoicePaid),
          amount: round2(invoicePaid),
          payoutDate: `${invoiceForm.invoicePeriod || currentMonth()}-01`,
          paymentDate: invoiceForm.paymentDate,
          paymentMethod: invoiceForm.paymentMethod,
          note: invoiceForm.note.trim(),
        }
      : {
          ...payoutForm,
          amount: parseDecimal(payoutForm.paid),
          paid: parseDecimal(payoutForm.paid),
          numberOfSessions: parseDecimal(payoutForm.numberOfSessions),
          extraSessions: parseDecimal(payoutForm.extraSessions),
          sessionRate: parseDecimal(payoutForm.sessionRate),
          manualAdjustment: parseDecimal(payoutForm.manualAdjustment),
          totalDue: parseDecimal(payoutForm.totalDue),
          courseId: payoutForm.courseId || undefined,
        };

    const url = editingId
      ? `/api/admin/finance/teacher-payouts/${editingId}`
      : "/api/admin/finance/teacher-payouts";
    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "حدث خطأ أثناء الحفظ");
      return;
    }
    setMessage(
      editingId
        ? isInvoice
          ? invoiceAction === "approve"
            ? "تم اعتماد فاتورة الأستاذ"
            : "تم حفظ فاتورة الأستاذ"
          : "تم تحديث المستحق"
        : isInvoice
          ? invoiceAction === "approve"
            ? "تم اعتماد فاتورة الأستاذ"
            : "تم حفظ فاتورة الأستاذ"
          : "تمت إضافة المستحق"
    );
    setModalOpen(false);
    loadPayouts();
    setTimeout(() => setMessage(""), 3000);
  }

  async function registerInvoicePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentFor || submittingPayment) return;
    setError("");
    setSubmittingPayment(true);
    const res = await fetch("/api/admin/finance/teacher-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacherId: paymentFor.teacherId,
        invoiceIds: [paymentFor._id],
        amount: round2(parseDecimal(paymentAmount)),
        paymentMethod,
        paymentDate,
        accountType: paymentAccountType,
        accountName: paymentAccountName.trim(),
        referenceNumber: paymentReference.trim(),
        notes: paymentNotes.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "تعذر تسجيل الدفع");
      setSubmittingPayment(false);
      return;
    }
    setMessage("تم تسجيل الدفع وتحديث الصندوق");
    setPaymentFor(null);
    setSubmittingPayment(false);
    loadPayouts();
  }

  async function cancelInvoice(p: Payout) {
    if (!confirm("هل تريد إلغاء فاتورة الأستاذ؟")) return;
    const res = await fetch(`/api/admin/finance/teacher-payouts/${p._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceStatus: "cancelled" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "تعذر إلغاء الفاتورة");
      return;
    }
    setMessage("تم إلغاء فاتورة الأستاذ");
    loadPayouts();
  }

  async function handleDelete(id: string) {
    if (!confirm("هل تريد حذف هذا المستحق؟")) return;
    await fetch(`/api/admin/finance/teacher-payouts/${id}`, { method: "DELETE" });
    setMessage("تم الحذف");
    loadPayouts();
    setTimeout(() => setMessage(""), 3000);
  }

  function toTeacherInvoiceDocument(p: Payout) {
    const teacher = teachers.find((t) => t._id === p.teacherId);
    return createTeacherInvoiceDocument({
      ...p,
      subject: teacher?.subject,
    });
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}
      {error && !modalOpen && !paymentFor && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap gap-3">
        <select className="input-field" value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
          <option value="">كل الأساتذة</option>
          {teachers.map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>
        <select className="input-field" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">كل الدورات</option>
          {courses.map((c) => (
            <option key={c._id} value={c._id}>{c.title}</option>
          ))}
        </select>
        <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="pending">معلق</option>
          <option value="paid">مدفوع</option>
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={loadPayouts}>تطبيق</Button>
        <div className="mr-auto flex flex-wrap gap-3">
          <Button onClick={openInvoiceCreate}>
            <Plus className="h-4 w-4" />
            إضافة فاتورة أستاذ
          </Button>
          <Button onClick={openPayoutCreate}>
            <Plus className="h-4 w-4" />
            إضافة مستحق
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted">جاري التحميل...</p>
      ) : payouts.length === 0 ? (
        <EmptyState title="لا توجد مستحقات" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-pink-50 text-muted">
              <tr>
                <th className="p-3 text-start">الأستاذ</th>
                <th className="p-3 text-start">الدورة</th>
                <th className="p-3 text-start">النوع</th>
                <th className="p-3 text-start">المستحق</th>
                <th className="p-3 text-start">المدفوع</th>
                <th className="p-3 text-start">المتبقي</th>
                <th className="p-3 text-start">الحالة</th>
                <th className="p-3 text-start">التاريخ</th>
                <th className="p-3 text-start">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p._id} className="border-t border-border">
                  <td className="p-3 font-medium">{p.teacherName}</td>
                  <td className="p-3">{p.courseTitle || "—"}</td>
                  <td className="p-3">{p.recordType === "teacher_invoice" ? "فاتورة أستاذ" : "مستحق"}</td>
                  <td className="p-3 font-bold">{formatCurrency(p.totalDue)}</td>
                  <td className="p-3">{formatCurrency(p.paid)}</td>
                  <td className="p-3">{formatCurrency(p.remaining)}</td>
                  <td className="p-3">
                    {p.invoiceStatus === "cancelled" ? (
                      <span className="badge badge-inactive">ملغاة</span>
                    ) : (
                      <span className={`badge ${p.paymentStatus === "paid" || p.status === "paid" ? "badge-active" : "badge-inactive"}`}>
                        {p.recordType === "teacher_invoice"
                          ? labelOf(LESSON_PAYMENT_STATUSES, p.paymentStatus || "unpaid")
                          : p.status === "paid"
                            ? "مدفوع"
                            : "معلق"}
                      </span>
                    )}
                  </td>
                  <td className="p-3">{formatDate(p.payoutDate)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {p.recordType === "teacher_invoice" && (
                        <DocumentActionButtons
                          document={toTeacherInvoiceDocument(p)}
                          onView={setViewingDocument}
                        />
                      )}
                      <button type="button" onClick={() => setViewing(p)} className="text-muted" title="عرض">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => openEdit(p)} className="text-primary" title="تعديل">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {p.recordType === "teacher_invoice" && p.invoiceStatus !== "cancelled" && p.remaining > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentFor(p);
                            setPaymentAmount(String(p.remaining));
                            setPaymentMethod(p.paymentMethod || "cash");
                            setPaymentDate(today());
                            setPaymentAccountType("cash");
                            setPaymentAccountName("");
                            setPaymentReference("");
                            setPaymentNotes("");
                            setError("");
                          }}
                          className="text-green-700"
                          title="تسجيل دفع"
                        >
                          <CreditCard className="h-4 w-4" />
                        </button>
                      )}
                      {p.recordType === "teacher_invoice" && p.invoiceStatus !== "cancelled" && (
                        <button type="button" onClick={() => cancelInvoice(p)} className="text-amber-700" title="إلغاء">
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => handleDelete(p._id)} className="text-red-600" title="حذف">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "تعديل" : mode === "teacher_invoice" ? "إضافة فاتورة أستاذ" : "إضافة مستحق"} size="lg">
        <form
          onSubmit={handleSubmit}
          className={mode === "teacher_invoice" ? "max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto px-1" : "space-y-4"}
        >
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {mode === "teacher_invoice" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="الأستاذ *" value={invoiceForm.teacherId} onChange={onInvoiceTeacherChange} required>
                  <option value="">اختر أستاذاً</option>
                  {teachers.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </SelectField>
                <SelectField label="المادة / الدورة *" value={invoiceForm.courseId} onChange={(value) => setInvoiceForm({ ...invoiceForm, courseId: value })} required>
                  <option value="">اختر الدورة</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>{c.title}</option>
                  ))}
                </SelectField>
                <Input label="الموسم الدراسي" value={invoiceForm.academicSeason} onChange={(e) => setInvoiceForm({ ...invoiceForm, academicSeason: e.target.value })} />
                <Input label="شهر الفاتورة / الفترة *" type="month" required value={invoiceForm.invoicePeriod} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoicePeriod: e.target.value })} />
                <Input label="عدد الحصص المنجزة *" type="number" min="1" value={invoiceForm.numberOfSessions} onChange={(e) => setInvoiceForm({ ...invoiceForm, numberOfSessions: e.target.value, totalDue: "" })} />
                <Input label="سعر الحصة *" type="text" inputMode="decimal" min="0" step="0.01" value={invoiceForm.sessionRate} onChange={(e) => setInvoiceForm({ ...invoiceForm, sessionRate: e.target.value, totalDue: "" })} />
                <Input label="نسبة الإدارة %" type="text" inputMode="decimal" min="0" max="100" step="0.01" value={invoiceForm.administrationPercentage} onChange={(e) => setInvoiceForm({ ...invoiceForm, administrationPercentage: e.target.value, teacherPercentage: String(round2(Math.max(0, 100 - parseDecimal(e.target.value)))), totalDue: "" })} />
                <Input label="نسبة الأستاذ %" type="text" inputMode="decimal" min="0" max="100" step="0.01" value={invoiceForm.teacherPercentage} onChange={(e) => setInvoiceForm({ ...invoiceForm, teacherPercentage: e.target.value, totalDue: "" })} />
                <Input label="الخصومات" type="text" inputMode="decimal" min="0" step="0.01" value={invoiceForm.deductions} onChange={(e) => setInvoiceForm({ ...invoiceForm, deductions: e.target.value, totalDue: "" })} />
                <Input label="صافي مستحق الأستاذ" type="text" inputMode="decimal" min="0" step="0.01" value={invoiceForm.totalDue === "" ? String(netTeacherAmount.toFixed(2)) : invoiceForm.totalDue} onChange={(e) => setInvoiceForm({ ...invoiceForm, totalDue: e.target.value })} />
                <Input label="المبلغ المدفوع" type="text" inputMode="decimal" min="0" step="0.01" value={invoiceForm.paid} onChange={(e) => setInvoiceForm({ ...invoiceForm, paid: e.target.value })} />
                <Input label="تاريخ الدفع" type="date" value={invoiceForm.paymentDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentDate: e.target.value })} />
                <SelectField label="طريقة الدفع" value={invoiceForm.paymentMethod} onChange={(value) => setInvoiceForm({ ...invoiceForm, paymentMethod: value })}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </SelectField>
              </div>
              {selectedTeacher && (
                <p className="text-xs text-muted">الأستاذ: {selectedTeacher.name} — {selectedTeacher.subject}</p>
              )}
              <div className="grid gap-3 rounded-xl bg-pink-50/60 p-4 sm:grid-cols-2 lg:grid-cols-5">
                <SummaryField label="الإجمالي" value={formatCurrency(grossAmount)} />
                <SummaryField label="حصة الإدارة" value={formatCurrency(administrationShare)} />
                <SummaryField label="حصة الأستاذ" value={formatCurrency(teacherShareAmount)} />
                <SummaryField label="المتبقي" value={formatCurrency(invoiceRemaining)} />
                <SummaryField label="حالة الدفع" value={labelOf(LESSON_PAYMENT_STATUSES, invoicePaymentStatus)} />
              </div>
              <TextArea label="ملاحظات" value={invoiceForm.note} onChange={(value) => setInvoiceForm({ ...invoiceForm, note: value })} />
              <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-border bg-white pt-4 sm:flex-row">
                <Button type="submit" name="invoiceAction" value="save" variant="outline" className="min-w-0 flex-1 whitespace-nowrap">
                  حفظ الفاتورة
                </Button>
                {!editingId && (
                  <Button type="submit" name="invoiceAction" value="approve" className="min-w-0 flex-1 whitespace-nowrap">
                    اعتماد الفاتورة
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <SelectField label="الأستاذ" value={payoutForm.teacherId} onChange={(value) => setPayoutForm({ ...payoutForm, teacherId: value })} required>
                <option value="">اختر أستاذاً</option>
                {teachers.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </SelectField>
              <SelectField label="الدورة (اختياري)" value={payoutForm.courseId} onChange={(value) => setPayoutForm({ ...payoutForm, courseId: value })}>
                <option value="">بدون دورة</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>{c.title}</option>
                ))}
              </SelectField>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="عدد الحصص" type="number" min="0" value={payoutForm.numberOfSessions} onChange={(e) => setPayoutForm({ ...payoutForm, numberOfSessions: e.target.value })} />
                <Input label="حصص إضافية" type="number" min="0" value={payoutForm.extraSessions} onChange={(e) => setPayoutForm({ ...payoutForm, extraSessions: e.target.value })} />
                <Input label="قيمة الحصة" type="number" min="0" value={payoutForm.sessionRate} onChange={(e) => setPayoutForm({ ...payoutForm, sessionRate: e.target.value })} />
                <Input label="تعديل يدوي" type="number" value={payoutForm.manualAdjustment} onChange={(e) => setPayoutForm({ ...payoutForm, manualAdjustment: e.target.value })} />
                <Input label="إجمالي المستحق" type="number" min="0" value={payoutForm.totalDue} onChange={(e) => setPayoutForm({ ...payoutForm, totalDue: e.target.value })} />
                <Input label="المدفوع" type="number" min="0" value={payoutForm.paid} onChange={(e) => setPayoutForm({ ...payoutForm, paid: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="نوع المستحق" value={payoutForm.payoutType} onChange={(value) => setPayoutForm({ ...payoutForm, payoutType: value })}>
                  {PAYOUT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </SelectField>
                <Input label="تاريخ المستحق" type="date" required value={payoutForm.payoutDate} onChange={(e) => setPayoutForm({ ...payoutForm, payoutDate: e.target.value })} />
              </div>
              <TextArea label="ملاحظة" value={payoutForm.note} onChange={(value) => setPayoutForm({ ...payoutForm, note: value })} />
            </>
          )}
          {mode !== "teacher_invoice" && (
            <Button type="submit" fullWidth>{editingId ? "حفظ" : "إضافة"}</Button>
          )}
        </form>
      </Modal>

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title="تفاصيل فاتورة الأستاذ" size="lg">
        {viewing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryField label="الأستاذ" value={viewing.teacherName || "—"} />
            <SummaryField label="الدورة" value={viewing.courseTitle || "—"} />
            <SummaryField label="الفترة" value={viewing.invoicePeriod || "—"} />
            <SummaryField label="الحصص" value={String(viewing.numberOfSessions || 0)} />
            <SummaryField label="الإجمالي" value={formatCurrency(viewing.grossAmount || viewing.totalDue)} />
            <SummaryField label="حصة الإدارة" value={formatCurrency(viewing.administrationShare || 0)} />
            <SummaryField label="حصة الأستاذ" value={formatCurrency(viewing.teacherShareAmount || viewing.totalDue)} />
            <SummaryField label="الخصومات" value={formatCurrency(viewing.deductions || 0)} />
            <SummaryField label="الصافي" value={formatCurrency(viewing.netTeacherAmount || viewing.totalDue)} />
            <SummaryField label="المدفوع" value={formatCurrency(viewing.paid)} />
            <SummaryField label="المتبقي" value={formatCurrency(viewing.remaining)} />
            <SummaryField label="حالة الدفع" value={labelOf(LESSON_PAYMENT_STATUSES, viewing.paymentStatus || "unpaid")} />
            <SummaryField label="طريقة الدفع" value={labelOf(PAYMENT_METHODS, viewing.paymentMethod || "") || "—"} />
            <SummaryField label="ملاحظات" value={viewing.note || "—"} />
          </div>
        )}
      </Modal>

      <Modal open={Boolean(viewingDocument)} onClose={() => setViewingDocument(null)} title="عرض المستند" size="lg">
        {viewingDocument && <FinancialDocumentView document={viewingDocument} />}
      </Modal>

      <Modal open={Boolean(paymentFor)} onClose={() => setPaymentFor(null)} title="تسجيل دفع فاتورة أستاذ" size="md">
        <form onSubmit={registerInvoicePayment} className="space-y-4">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {paymentFor && (
            <div className="rounded-xl bg-pink-50/60 p-4 text-sm">
              المتبقي: <strong>{formatCurrency(paymentFor.remaining)}</strong>
            </div>
          )}
          <Input label="مبلغ الدفع" type="text" inputMode="decimal" min="0" step="0.01" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          <Input label="تاريخ الدفع" type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          <SelectField label="طريقة الدفع" value={paymentMethod} onChange={setPaymentMethod}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </SelectField>
          <SelectField label="الصندوق / الحساب" value={paymentAccountType} onChange={setPaymentAccountType}>
            <option value="cash">الصندوق النقدي</option>
            <option value="bank">حساب بنكي</option>
          </SelectField>
          <Input label="اسم الحساب" value={paymentAccountName} onChange={(e) => setPaymentAccountName(e.target.value)} />
          <Input label="رقم المرجع" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
          <TextArea label="ملاحظات" value={paymentNotes} onChange={setPaymentNotes} />
          <Button type="submit" fullWidth disabled={submittingPayment}>
            {submittingPayment ? "جاري التسجيل..." : "دفع الأستاذ"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <select className="input-field w-full" required={required} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <textarea className="input-field w-full resize-none" rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
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
