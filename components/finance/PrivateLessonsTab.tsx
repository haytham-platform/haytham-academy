"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Download, Eye, Pencil, Plus, Printer, RefreshCw, Save, Trash2, XCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import { formatDate } from "@/lib/finance-labels";

type PaymentStatus = "paid" | "unpaid" | "partially_paid";
type LessonStatus = "scheduled" | "completed" | "cancelled" | "no_show";

interface StudentOption { _id: string; name: string; guardianPhone?: string; phone?: string; academicLevel?: string; studyLevel?: string }
interface TeacherOption { _id: string; name: string; subject?: string; academicLevel?: string; teachingLevel?: string }
interface PricingOption { configurationType: string; teacherId: string; academicLevel: string; price: number; isActive: boolean }
interface Lesson {
  _id: string;
  students: { studentId: string; name: string; phone?: string }[];
  teacherId: string;
  teacherName: string;
  subject: string;
  academicLevel: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  price: number;
  paidAmount: number;
  remainingAmount: number;
  notes: string;
}

const defaults = {
  studentId: "",
  teacherId: "",
  lessonDate: new Date().toISOString().slice(0, 10),
  startTime: "10:00",
  endTime: "11:00",
  guardianPhone: "",
  lessonPrice: "",
  amountPaid: "",
  paymentStatus: "unpaid" as PaymentStatus,
  status: "scheduled" as LessonStatus,
  notes: "",
  subject: "",
  academicLevel: "",
  academicSeason: "",
  room: "",
  format: "individual",
  manualPriceOverrideReason: "",
};

const statusLabels: Record<string, string> = {
  scheduled: "مجدولة",
  completed: "مكتملة",
  cancelled: "ملغاة",
  no_show: "غياب الطالب",
  paid: "مدفوع",
  unpaid: "غير مدفوع",
  partially_paid: "مدفوع جزئيًا",
};

function money(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function paymentStatusFor(price: number, paid: number): PaymentStatus {
  if (price > 0 && paid >= price) return "paid";
  return paid > 0 ? "partially_paid" : "unpaid";
}

export default function PrivateLessonsTab() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [pricing, setPricing] = useState<PricingOption[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasPrev: false, hasNext: false });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(defaults);
  const [modal, setModal] = useState<"" | "create" | "edit" | "view" | "payment" | "cancel">("");
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedStudent = useMemo(() => students.find((student) => student._id === form.studentId), [students, form.studentId]);
  const selectedTeacher = useMemo(() => teachers.find((teacher) => teacher._id === form.teacherId), [teachers, form.teacherId]);
  const price = money(form.lessonPrice);
  const paid = money(form.amountPaid);
  const remaining = Math.max(0, price - paid);

  const configuredPrice = useCallback((teacherId: string, academicLevel: string) => {
    const teacherRate = pricing.find((item) => item.isActive && item.configurationType === "teacher_specific" && item.teacherId === teacherId);
    if (teacherRate) return teacherRate.price;
    const levelRate = pricing.find((item) => item.isActive && item.configurationType === "academic_level_default" && item.academicLevel === academicLevel);
    return levelRate?.price ?? 0;
  }, [pricing]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const [lessonRes, studentRes, teacherRes, pricingRes] = await Promise.all([
      fetch(`/api/admin/private-lessons?${params}`),
      fetch("/api/admin/students?limit=500"),
      fetch("/api/admin/teachers?limit=500&eligiblePrivateLessons=true"),
      fetch("/api/admin/private-lessons/pricing?activeOnly=true"),
    ]);
    const [lessonData, studentData, teacherData, pricingData] = await Promise.all([lessonRes.json(), studentRes.json(), teacherRes.json(), pricingRes.json()]);
    setLessons(lessonData.lessons || []);
    setStudents(studentData.students || []);
    setTeachers(teacherData.teachers || []);
    setPricing(pricingData.pricing || []);
    if (lessonData.pagination) setPagination(lessonData.pagination);
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) void loadAll().catch(() => setLoading(false));
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadAll]);

  function patchForm(update: Partial<typeof defaults>) {
    const next = { ...form, ...update };
    const nextPrice = money(next.lessonPrice);
    const nextPaid = money(next.amountPaid);
    next.paymentStatus = paymentStatusFor(nextPrice, nextPaid);
    setForm(next);
  }

  function chooseStudent(studentId: string) {
    const student = students.find((item) => item._id === studentId);
    const academicLevel = student?.academicLevel || student?.studyLevel || form.academicLevel;
    const autoPrice = configuredPrice(form.teacherId, academicLevel);
    patchForm({
      studentId,
      guardianPhone: student?.guardianPhone || student?.phone || "",
      academicLevel,
      lessonPrice: autoPrice ? String(autoPrice) : form.lessonPrice,
    });
  }

  function chooseTeacher(teacherId: string) {
    const teacher = teachers.find((item) => item._id === teacherId);
    const academicLevel = form.academicLevel || teacher?.academicLevel || teacher?.teachingLevel || "";
    const autoPrice = configuredPrice(teacherId, academicLevel);
    patchForm({
      teacherId,
      subject: teacher?.subject || form.subject,
      academicLevel,
      lessonPrice: autoPrice ? String(autoPrice) : form.lessonPrice,
    });
  }

  async function requestJson(url: string, body: object, method = "POST") {
    if (submitting) return false;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "حدث خطأ");
        return false;
      }
      setModal("");
      setSelected(null);
      setPaymentAmount("");
      await loadAll();
      return true;
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(lesson: Lesson) {
    const student = lesson.students[0];
    setSelected(lesson);
    setForm({
      ...defaults,
      studentId: student?.studentId || "",
      teacherId: lesson.teacherId,
      lessonDate: lesson.lessonDate?.slice(0, 10) || defaults.lessonDate,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      guardianPhone: student?.phone || "",
      lessonPrice: String(lesson.price || ""),
      amountPaid: "",
      paymentStatus: lesson.paymentStatus as PaymentStatus,
      status: lesson.status as LessonStatus,
      notes: lesson.notes || "",
      subject: lesson.subject || "",
      academicLevel: lesson.academicLevel || "",
    });
    setModal("edit");
  }

  async function submitLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!form.studentId) return setError("الطالب مطلوب.");
    if (!form.teacherId) return setError("الأستاذ مطلوب.");
    if (form.endTime <= form.startTime) return setError("وقت النهاية يجب أن يكون بعد وقت البداية.");
    if (paid > price) return setError("لا يمكن أن يتجاوز المدفوع سعر الحصة.");
    await requestJson(modal === "edit" && selected ? `/api/admin/private-lessons/${selected._id}` : "/api/admin/private-lessons", {
      studentIds: [form.studentId],
      teacherId: form.teacherId,
      lessonDate: form.lessonDate,
      startTime: form.startTime,
      endTime: form.endTime,
      subject: form.subject || selectedTeacher?.subject || "حصة خاصة",
      academicLevel: form.academicLevel || selectedStudent?.academicLevel || selectedStudent?.studyLevel || "عام",
      academicSeason: form.academicSeason,
      room: form.room,
      format: form.format,
      status: form.status,
      manualPrice: form.lessonPrice ? price : undefined,
      manualPriceOverrideReason: form.manualPriceOverrideReason || "تعديل من نموذج الحصة اليومية",
      amountPaid: paid,
      idempotencyKey: `pl-create-${form.studentId}-${form.teacherId}-${form.lessonDate}-${form.startTime}`,
      notes: `${form.notes}${form.guardianPhone ? `\nهاتف الولي: ${form.guardianPhone}` : ""}`,
    }, modal === "edit" ? "PUT" : "POST");
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > selected.remainingAmount) return setError("مبلغ الدفع غير صالح.");
    await requestJson(`/api/admin/private-lessons/${selected._id}/payments`, {
      amount,
      paymentMethod: "cash",
      idempotencyKey: `pl-pay-${selected._id}-${amount}-${Date.now()}`,
    });
  }

  async function deleteLesson(lesson: Lesson) {
    if (!window.confirm("هل تريد حذف الحصة؟ لن يتم حذف السجل المالي المرتبط بها.")) return;
    await requestJson(`/api/admin/private-lessons/${lesson._id}`, {}, "DELETE");
  }

  function printReceipt(lesson: Lesson) {
    window.open(`/api/admin/private-lessons/${lesson._id}/receipt?format=html`, "_blank", "noopener,noreferrer");
  }

  function downloadReceipt(lesson: Lesson) {
    window.location.href = `/api/admin/private-lessons/${lesson._id}/receipt?format=pdf`;
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <input className="input-field max-w-sm" placeholder="بحث عن طالب أو أستاذ" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
          <select className="input-field w-44" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="">كل الحالات</option>
            <option value="scheduled">مجدولة</option>
            <option value="completed">مكتملة</option>
            <option value="cancelled">ملغاة</option>
            <option value="no_show">غياب الطالب</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => loadAll()}><RefreshCw className="h-4 w-4" /> تحديث</Button>
          <Button type="button" onClick={() => { setForm(defaults); setModal("create"); }}><Plus className="h-4 w-4" /> حصة خاصة</Button>
        </div>
      </div>
      {error && <ApiErrorAlert error={error} />}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-muted">
            <tr>
              {["الطالب", "الأستاذ", "التاريخ", "التوقيت", "هاتف الولي", "سعر الحصة", "المدفوع", "المتبقي", "حالة الدفع", "حالة الحصة", "الإجراءات"].map((header) => <th key={header} className="p-3">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="p-6 text-center text-muted">جاري التحميل...</td></tr>
            ) : lessons.length ? lessons.map((lesson) => (
              <tr key={lesson._id} className="border-t border-border">
                <td className="p-3">{lesson.students.map((s) => s.name).join("، ")}</td>
                <td className="p-3">{lesson.teacherName}</td>
                <td className="p-3">{formatDate(lesson.lessonDate)}</td>
                <td className="p-3">{lesson.startTime} - {lesson.endTime}</td>
                <td className="p-3">{lesson.students[0]?.phone || "-"}</td>
                <td className="p-3">{lesson.price}</td>
                <td className="p-3">{lesson.paidAmount || 0}</td>
                <td className="p-3">{lesson.remainingAmount ?? lesson.price}</td>
                <td className="p-3">{statusLabels[lesson.paymentStatus] || lesson.paymentStatus}</td>
                <td className="p-3">{statusLabels[lesson.status] || lesson.status}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <button title="عرض" className="text-primary" onClick={() => { setSelected(lesson); setModal("view"); }}><Eye className="h-4 w-4" /></button>
                    <button title="تعديل" className="text-blue-700" onClick={() => openEdit(lesson)}><Pencil className="h-4 w-4" /></button>
                    <button title="تسجيل دفعة" className="text-green-700" onClick={() => { setSelected(lesson); setPaymentAmount(String(lesson.remainingAmount || "")); setModal("payment"); }}>دفعة</button>
                    <button title="تحديد كمكتملة" className="text-green-700" onClick={() => requestJson(`/api/admin/private-lessons/${lesson._id}/complete`, {})}><CheckCircle className="h-4 w-4" /></button>
                    <button title="إلغاء" className="text-red-700" onClick={() => { setSelected(lesson); setModal("cancel"); }}><XCircle className="h-4 w-4" /></button>
                    <button title="طباعة الإيصال" onClick={() => printReceipt(lesson)}><Printer className="h-4 w-4" /></button>
                    <button title="تحميل PDF" onClick={() => downloadReceipt(lesson)}><Download className="h-4 w-4" /></button>
                    <button title="حذف" className="text-red-700" onClick={() => deleteLesson(lesson)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={11} className="p-6"><EmptyState title={students.length ? "لا توجد حصص خاصة" : "لا يوجد طلاب متاحون"} description={students.length ? "أنشئ حصة خاصة مرتبطة بطالب وأستاذ من البيانات الحقيقية." : "أضف الطلاب أولا حتى تتمكن من جدولة الحصص الخاصة."} /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} hasPrev={pagination.hasPrev} hasNext={pagination.hasNext} onPageChange={setPage} />

      <Modal open={modal === "create" || modal === "edit"} onClose={() => setModal("")} title="حصة خاصة" size="xl">
        <form className="space-y-3 text-sm" onSubmit={submitLesson}>
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="الطالب" value={form.studentId} onChange={chooseStudent} options={students.map((s) => ({ value: s._id, label: s.name }))} required />
            <Select label="الأستاذ" value={form.teacherId} onChange={chooseTeacher} options={teachers.map((t) => ({ value: t._id, label: t.name }))} required />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input label="التاريخ" type="date" value={form.lessonDate} onChange={(lessonDate) => patchForm({ lessonDate })} required />
            <Input label="وقت البداية" type="time" value={form.startTime} onChange={(startTime) => patchForm({ startTime })} required />
            <Input label="وقت النهاية" type="time" value={form.endTime} onChange={(endTime) => patchForm({ endTime })} required />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="هاتف الولي" value={form.guardianPhone} onChange={(guardianPhone) => patchForm({ guardianPhone })} />
            <Input label="سعر الحصة" type="number" value={form.lessonPrice} onChange={(lessonPrice) => patchForm({ lessonPrice })} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input label="المدفوع" type="number" value={form.amountPaid} onChange={(amountPaid) => patchForm({ amountPaid })} />
            <Input label="المتبقي" value={String(remaining)} onChange={() => null} disabled />
            <Input label="حالة الدفع" value={statusLabels[form.paymentStatus]} onChange={() => null} disabled />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="حالة الحصة" value={form.status} onChange={(value) => patchForm({ status: value as LessonStatus })} options={[{ value: "scheduled", label: "مجدولة" }, { value: "completed", label: "مكتملة" }, { value: "cancelled", label: "ملغاة" }, { value: "no_show", label: "غياب الطالب" }]} />
            <Input label="ملاحظات" value={form.notes} onChange={(notes) => patchForm({ notes })} />
          </div>
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-semibold">تفاصيل إضافية</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input label="المادة" value={form.subject} onChange={(subject) => patchForm({ subject })} />
              <Input label="المستوى" value={form.academicLevel} onChange={(academicLevel) => patchForm({ academicLevel })} />
              <Input label="الموسم" value={form.academicSeason} onChange={(academicSeason) => patchForm({ academicSeason })} />
              <Input label="القاعة" value={form.room} onChange={(room) => patchForm({ room })} />
              <Select label="النمط" value={form.format} onChange={(format) => patchForm({ format })} options={[{ value: "individual", label: "فردية" }, { value: "small_group", label: "مجموعة صغيرة" }, { value: "online", label: "عن بعد" }, { value: "in_person", label: "حضورية" }]} />
              <Input label="سبب تعديل السعر" value={form.manualPriceOverrideReason} onChange={(manualPriceOverrideReason) => patchForm({ manualPriceOverrideReason })} />
            </div>
          </details>
          <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-border bg-white px-5 py-3">
            <Button type="button" variant="outline" onClick={() => setModal("")}>إلغاء</Button>
            <Button type="submit" loading={submitting}><Save className="h-4 w-4" /> حفظ</Button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "view"} onClose={() => setModal("")} title="تفاصيل الحصة" size="xl">
        {selected && <div className="space-y-2 text-sm">
          <p><b>الطالب:</b> {selected.students.map((s) => s.name).join("، ")}</p>
          <p><b>الأستاذ:</b> {selected.teacherName}</p>
          <p><b>التاريخ:</b> {formatDate(selected.lessonDate)} {selected.startTime} - {selected.endTime}</p>
          <p><b>السعر:</b> {selected.price} | <b>المدفوع:</b> {selected.paidAmount || 0} | <b>المتبقي:</b> {selected.remainingAmount}</p>
          <p><b>ملاحظات:</b> {selected.notes || "-"}</p>
        </div>}
      </Modal>

      <Modal open={modal === "payment"} onClose={() => setModal("")} title="تسجيل دفعة">
        <form className="space-y-3" onSubmit={recordPayment}>
          <Input label="المبلغ" type="number" value={paymentAmount} onChange={setPaymentAmount} required />
          <Button type="submit" loading={submitting}>تسجيل الدفعة</Button>
        </form>
      </Modal>

      <Modal open={modal === "cancel"} onClose={() => setModal("")} title="إلغاء الحصة">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (selected) void requestJson(`/api/admin/private-lessons/${selected._id}/cancel`, { reason: "إلغاء من جدول الحصص الخاصة" }); }}>
          <p className="text-sm text-muted">سيتم حفظ الإلغاء في سجل التدقيق مع الحفاظ على السجل المالي.</p>
          <Button type="submit" variant="danger" loading={submitting}>إلغاء الحصة</Button>
        </form>
      </Modal>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; disabled?: boolean }) {
  return <label className="block text-sm font-medium">{label}<input className="input-field mt-1 !py-2" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} /></label>;
}

function Select({ label, value, onChange, options, required = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; required?: boolean }) {
  return <label className="block text-sm font-medium">{label}<select className="input-field mt-1 !py-2" value={value} onChange={(e) => onChange(e.target.value)} required={required}><option value="">اختر</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
