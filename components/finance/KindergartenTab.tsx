"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, Pencil, Plus, Printer, RefreshCw, Save, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";

interface TeacherOption { _id: string; name: string }
interface StudentOption { _id: string; name: string; guardianPhone?: string; phone?: string }
interface Registration {
  _id: string;
  childId?: string;
  childName: string;
  teacherId: string;
  teacherName: string;
  guardianPhone: string;
  registrationDate: string;
  startDate: string;
  groupName: string;
  registrationFee: number;
  registrationPaid: number;
  registrationRemaining: number;
  registrationPaymentStatus: string;
  subscriptionType: "weekly" | "monthly";
  subscriptionPrice: number;
  currentPeriod: string;
  attendanceSchedule?: string;
  startTime?: string;
  endTime?: string;
  subscriptionPaid: number;
  subscriptionRemaining: number;
  subscriptionPaymentStatus: string;
  totalOutstanding: number;
  status: string;
  notes: string;
  payments: { _id?: string; receiptNumber?: string }[];
}

const defaults = {
  childId: "",
  childName: "",
  teacherId: "",
  guardianPhone: "",
  registrationDate: new Date().toISOString().slice(0, 10),
  startDate: new Date().toISOString().slice(0, 10),
  groupName: "",
  registrationFee: "",
  fileFeePaid: "",
  subscriptionAmount: "",
  subscriptionType: "monthly" as "weekly" | "monthly",
  subscriptionPaid: "",
  notes: "",
  startTime: "08:00",
  endTime: "12:00",
  attendanceSchedule: "يومي",
  currentPeriod: new Date().toISOString().slice(0, 7),
  status: "active",
};

const labels: Record<string, string> = {
  paid: "مدفوع",
  unpaid: "غير مدفوع",
  partially_paid: "مدفوع جزئيًا",
  overdue: "متأخر",
  weekly: "أسبوعي",
  monthly: "شهري",
  active: "نشط",
  suspended: "معلق",
  withdrawn: "منسحب",
  completed: "منتهي",
};

function amount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function statusFor(total: number, paid: number) {
  if (total <= 0 || paid >= total) return "paid";
  return paid > 0 ? "partially_paid" : "unpaid";
}

export default function KindergartenTab() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasPrev: false, hasNext: false });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"" | "create" | "edit" | "view" | "payment" | "history" | "subscription">("");
  const [selected, setSelected] = useState<Registration | null>(null);
  const [form, setForm] = useState(defaults);
  const [payment, setPayment] = useState({ paymentType: "registration_fee", amount: "", paymentMethod: "cash" });
  const [subscriptionChange, setSubscriptionChange] = useState({ subscriptionType: "monthly", subscriptionAmount: "", currentPeriod: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fileRemaining = Math.max(0, amount(form.registrationFee) - amount(form.fileFeePaid));
  const subscriptionRemaining = Math.max(0, amount(form.subscriptionAmount) - amount(form.subscriptionPaid));
  const totalRemaining = fileRemaining + subscriptionRemaining;
  const paymentStatus = statusFor(amount(form.registrationFee) + amount(form.subscriptionAmount), amount(form.fileFeePaid) + amount(form.subscriptionPaid));

  const loadAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) params.set("search", search);
    const [registrationRes, teacherRes, studentRes] = await Promise.all([
      fetch(`/api/admin/kindergarten?${params}`),
      fetch("/api/admin/teachers?limit=500&eligiblePrivateLessons=true"),
      fetch("/api/admin/students?limit=500&enrollmentType=kindergarten"),
    ]);
    const [registrationData, teacherData, studentData] = await Promise.all([registrationRes.json(), teacherRes.json(), studentRes.json()]);
    setRegistrations(registrationData.registrations || []);
    setTeachers(teacherData.teachers || []);
    setStudents(studentData.students || []);
    if (registrationData.pagination) setPagination(registrationData.pagination);
    setLoading(false);
  }, [page, search]);

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

  const paymentRemaining = useMemo(() => {
    if (!selected) return 0;
    return payment.paymentType === "registration_fee" ? selected.registrationRemaining : selected.subscriptionRemaining;
  }, [selected, payment.paymentType]);

  function chooseChild(childId: string) {
    const student = students.find((item) => item._id === childId);
    setForm({ ...form, childId, childName: student?.name || form.childName, guardianPhone: student?.guardianPhone || student?.phone || form.guardianPhone });
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
      await loadAll();
      return true;
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(item: Registration) {
    setSelected(item);
    setForm({
      ...defaults,
      childId: item.childId || "",
      childName: item.childName,
      teacherId: item.teacherId,
      guardianPhone: item.guardianPhone,
      registrationDate: item.registrationDate?.slice(0, 10) || defaults.registrationDate,
      startDate: item.startDate?.slice(0, 10) || defaults.startDate,
      groupName: item.groupName,
      registrationFee: String(item.registrationFee || ""),
      fileFeePaid: "",
      subscriptionAmount: String(item.subscriptionPrice || ""),
      subscriptionType: item.subscriptionType,
      subscriptionPaid: "",
      notes: item.notes || "",
      startTime: item.startTime || defaults.startTime,
      endTime: item.endTime || defaults.endTime,
      attendanceSchedule: item.attendanceSchedule || defaults.attendanceSchedule,
      currentPeriod: item.currentPeriod || defaults.currentPeriod,
      status: item.status || defaults.status,
    });
    setModal("edit");
  }

  async function submitRegistration(e: React.FormEvent) {
    e.preventDefault();
    if (!form.childName) return setError("اسم الطفل مطلوب.");
    if (!form.teacherId) return setError("المربية مطلوبة.");
    if (!form.groupName) return setError("الفوج مطلوب.");
    if (!form.guardianPhone) return setError("هاتف الولي مطلوب.");
    if (amount(form.fileFeePaid) > amount(form.registrationFee) || amount(form.subscriptionPaid) > amount(form.subscriptionAmount)) return setError("لا يمكن أن يتجاوز المدفوع قيمة الرسوم.");
    await requestJson(modal === "edit" && selected ? `/api/admin/kindergarten/${selected._id}` : "/api/admin/kindergarten", {
      ...form,
      weeklyPrice: form.subscriptionType === "weekly" ? form.subscriptionAmount : undefined,
      monthlyPrice: form.subscriptionType === "monthly" ? form.subscriptionAmount : undefined,
      weekPeriod: form.subscriptionType === "weekly" ? form.currentPeriod : undefined,
      monthPeriod: form.subscriptionType === "monthly" ? form.currentPeriod : undefined,
      amountPaid: form.subscriptionPaid,
    }, modal === "edit" ? "PUT" : "POST");
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const n = Number(payment.amount);
    if (!Number.isFinite(n) || n <= 0 || n > paymentRemaining) return setError("مبلغ الدفع غير صالح.");
    await requestJson(`/api/admin/kindergarten/${selected._id}/payments`, { ...payment, idempotencyKey: `kg-pay-${selected._id}-${payment.paymentType}-${n}-${Date.now()}` });
  }

  async function submitSubscription(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await requestJson(`/api/admin/kindergarten/${selected._id}/subscription`, {
      subscriptionType: subscriptionChange.subscriptionType,
      subscriptionPrice: subscriptionChange.subscriptionAmount,
      weeklyPrice: subscriptionChange.subscriptionType === "weekly" ? subscriptionChange.subscriptionAmount : undefined,
      monthlyPrice: subscriptionChange.subscriptionType === "monthly" ? subscriptionChange.subscriptionAmount : undefined,
      currentPeriod: subscriptionChange.currentPeriod,
      reason: subscriptionChange.reason,
    });
  }

  async function updateStatus(item: Registration, nextStatus: string) {
    await requestJson(`/api/admin/kindergarten/${item._id}`, { ...item, status: nextStatus }, "PUT");
  }

  async function archiveRegistration(item: Registration) {
    if (!window.confirm("هل تريد أرشفة التسجيل؟ لن يتم حذف السجل المالي.")) return;
    await requestJson(`/api/admin/kindergarten/${item._id}`, {}, "DELETE");
  }

  function printReceipt(registration: Registration) {
    window.open(`/api/admin/kindergarten/${registration._id}/receipt?format=html`, "_blank", "noopener,noreferrer");
  }

  function downloadReceipt(registration: Registration) {
    window.location.href = `/api/admin/kindergarten/${registration._id}/receipt?format=pdf`;
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input className="input-field max-w-sm" placeholder="بحث عن طفل أو ولي أو فوج" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => loadAll()}><RefreshCw className="h-4 w-4" /> تحديث</Button>
          <Button type="button" onClick={() => { setForm(defaults); setModal("create"); }}><Plus className="h-4 w-4" /> تسجيل طفل</Button>
        </div>
      </div>
      {error && <ApiErrorAlert error={error} />}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-muted">
            <tr>{["الطفل", "المربية", "تاريخ التسجيل", "تاريخ البداية", "الفوج", "هاتف الولي", "رسوم الملف", "حالة دفع الملف", "مبلغ الاشتراك", "نوع الاشتراك", "حالة الدفع", "المتبقي", "الإجراءات"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} className="p-6 text-center text-muted">جاري التحميل...</td></tr>
            ) : registrations.length ? registrations.map((item) => (
              <tr key={item._id} className="border-t border-border">
                <td className="p-3">{item.childName}</td>
                <td className="p-3">{item.teacherName}</td>
                <td className="p-3">{new Date(item.registrationDate).toLocaleDateString("ar-DZ")}</td>
                <td className="p-3">{new Date(item.startDate).toLocaleDateString("ar-DZ")}</td>
                <td className="p-3">{item.groupName}</td>
                <td className="p-3">{item.guardianPhone}</td>
                <td className="p-3">{item.registrationFee}</td>
                <td className="p-3">{labels[item.registrationPaymentStatus] || item.registrationPaymentStatus}</td>
                <td className="p-3">{item.subscriptionPrice}</td>
                <td className="p-3">{labels[item.subscriptionType]}</td>
                <td className="p-3">{labels[item.subscriptionPaymentStatus] || item.subscriptionPaymentStatus}</td>
                <td className="p-3">{item.totalOutstanding}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <button title="عرض" className="text-primary" onClick={() => { setSelected(item); setModal("view"); }}><Eye className="h-4 w-4" /></button>
                    <button title="تعديل" className="text-blue-700" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></button>
                    <button className="text-green-700" onClick={() => { setSelected(item); setPayment({ paymentType: item.registrationRemaining > 0 ? "registration_fee" : item.subscriptionType === "weekly" ? "weekly_fee" : "monthly_fee", amount: "", paymentMethod: "cash" }); setModal("payment"); }}>دفعة</button>
                    <button className="text-blue-700" onClick={() => { setSelected(item); setModal("history"); }}>سجل</button>
                    <button className="text-blue-700" onClick={() => { setSelected(item); setSubscriptionChange({ subscriptionType: item.subscriptionType === "weekly" ? "monthly" : "weekly", subscriptionAmount: "", currentPeriod: "", reason: "" }); setModal("subscription"); }}>تغيير</button>
                    <button className="text-amber-700" onClick={() => updateStatus(item, "suspended")}>تعليق</button>
                    <button className="text-slate-700" onClick={() => updateStatus(item, "completed")}>إنهاء</button>
                    <button title="طباعة" onClick={() => printReceipt(item)}><Printer className="h-4 w-4" /></button>
                    <button title="تحميل PDF" onClick={() => downloadReceipt(item)}><Download className="h-4 w-4" /></button>
                    <button title="حذف" className="text-red-700" onClick={() => archiveRegistration(item)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={13} className="p-6"><EmptyState title="لا توجد تسجيلات روضة" description="ابدأ بتسجيل طفل مع رسوم ملف واشتراك أسبوعي أو شهري." /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} hasPrev={pagination.hasPrev} hasNext={pagination.hasNext} onPageChange={setPage} />

      <Modal open={modal === "create" || modal === "edit"} onClose={() => setModal("")} title="تسجيل الروضة" size="xl">
        <form className="space-y-3 text-sm" onSubmit={submitRegistration}>
          <Section title="بيانات الطفل">
            <div className="grid gap-3 md:grid-cols-2">
              <Select label="طفل مسجل" value={form.childId} onChange={chooseChild} options={students.map((s) => ({ value: s._id, label: s.name }))} />
              <Input label="اسم الطفل" value={form.childName} onChange={(childName) => setForm({ ...form, childName })} required />
              <Select label="المربية" value={form.teacherId} onChange={(teacherId) => setForm({ ...form, teacherId })} options={teachers.map((teacher) => ({ value: teacher._id, label: teacher.name }))} required />
              <Input label="هاتف الولي" value={form.guardianPhone} onChange={(guardianPhone) => setForm({ ...form, guardianPhone })} required />
              <Input label="تاريخ التسجيل" type="date" value={form.registrationDate} onChange={(registrationDate) => setForm({ ...form, registrationDate })} required />
              <Input label="تاريخ البداية" type="date" value={form.startDate} onChange={(startDate) => setForm({ ...form, startDate })} required />
              <Input label="الفوج" value={form.groupName} onChange={(groupName) => setForm({ ...form, groupName })} required />
            </div>
          </Section>
          <Section title="رسوم التسجيل">
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="رسوم الملف" type="number" value={form.registrationFee} onChange={(registrationFee) => setForm({ ...form, registrationFee })} />
              <Input label="دفع الملف" type="number" value={form.fileFeePaid} onChange={(fileFeePaid) => setForm({ ...form, fileFeePaid })} />
              <Input label="متبقي الملف" value={String(fileRemaining)} onChange={() => null} disabled />
            </div>
          </Section>
          <Section title="الاشتراك">
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="مبلغ الاشتراك" type="number" value={form.subscriptionAmount} onChange={(subscriptionAmount) => setForm({ ...form, subscriptionAmount })} />
              <Select label="نوع الاشتراك" value={form.subscriptionType} onChange={(subscriptionType) => setForm({ ...form, subscriptionType: subscriptionType as "weekly" | "monthly", currentPeriod: subscriptionType === "monthly" ? new Date().toISOString().slice(0, 7) : form.currentPeriod })} options={[{ value: "monthly", label: "شهري" }, { value: "weekly", label: "أسبوعي" }]} />
              <Input label="المدفوع" type="number" value={form.subscriptionPaid} onChange={(subscriptionPaid) => setForm({ ...form, subscriptionPaid })} />
              <Input label="حالة الدفع" value={labels[paymentStatus]} onChange={() => null} disabled />
              <Input label="المتبقي" value={String(totalRemaining)} onChange={() => null} disabled />
              <Input label="ملاحظات" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
            </div>
          </Section>
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-semibold">تفاصيل إضافية</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input label="وقت البداية" type="time" value={form.startTime} onChange={(startTime) => setForm({ ...form, startTime })} />
              <Input label="وقت النهاية" type="time" value={form.endTime} onChange={(endTime) => setForm({ ...form, endTime })} />
              <Input label="برنامج الحضور" value={form.attendanceSchedule} onChange={(attendanceSchedule) => setForm({ ...form, attendanceSchedule })} />
              <Input label="فترة الاشتراك" value={form.currentPeriod} onChange={(currentPeriod) => setForm({ ...form, currentPeriod })} />
              <Select label="حالة التسجيل" value={form.status} onChange={(status) => setForm({ ...form, status })} options={[{ value: "active", label: "نشط" }, { value: "suspended", label: "معلق" }, { value: "withdrawn", label: "منسحب" }, { value: "completed", label: "منتهي" }]} />
            </div>
          </details>
          <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-border bg-white px-5 py-3">
            <Button type="button" variant="outline" onClick={() => setModal("")}>إلغاء</Button>
            <Button type="submit" loading={submitting}><Save className="h-4 w-4" /> حفظ</Button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "view"} onClose={() => setModal("")} title="تفاصيل الروضة" size="xl">
        {selected && <div className="grid gap-2 text-sm md:grid-cols-2">
          <Summary title="رسوم التسجيل" value={selected.registrationFee} />
          <Summary title="مدفوع الملف" value={selected.registrationPaid} />
          <Summary title="الاشتراك" value={labels[selected.subscriptionType]} />
          <Summary title="مدفوع الاشتراك" value={selected.subscriptionPaid} />
          <Summary title="الرصيد" value={selected.totalOutstanding} />
          <Summary title="الدفعات" value={selected.payments.length} />
        </div>}
      </Modal>

      <Modal open={modal === "history"} onClose={() => setModal("")} title="سجل الدفعات" size="xl">
        <div className="space-y-2 text-sm">
          {selected?.payments?.length ? selected.payments.map((item, index) => <div key={item._id || index} className="rounded-lg border border-border p-3">{item.receiptNumber || "وصل بدون رقم"}</div>) : <EmptyState title="لا توجد دفعات" />}
        </div>
      </Modal>

      <Modal open={modal === "payment"} onClose={() => setModal("")} title="تسجيل دفعة">
        <form className="space-y-3" onSubmit={submitPayment}>
          <Select label="نوع الدفع" value={payment.paymentType} onChange={(paymentType) => setPayment({ ...payment, paymentType })} options={[{ value: "registration_fee", label: "رسوم الملف" }, { value: "weekly_fee", label: "اشتراك أسبوعي" }, { value: "monthly_fee", label: "اشتراك شهري" }]} />
          <Input label="المبلغ" type="number" value={payment.amount} onChange={(value) => setPayment({ ...payment, amount: value })} required />
          <Input label="المتبقي" value={String(paymentRemaining)} onChange={() => null} disabled />
          <Button type="submit" loading={submitting}>تسجيل الدفعة</Button>
        </form>
      </Modal>

      <Modal open={modal === "subscription"} onClose={() => setModal("")} title="تغيير الاشتراك">
        <form className="space-y-3" onSubmit={submitSubscription}>
          <Select label="الاشتراك الجديد" value={subscriptionChange.subscriptionType} onChange={(subscriptionType) => setSubscriptionChange({ ...subscriptionChange, subscriptionType })} options={[{ value: "monthly", label: "شهري" }, { value: "weekly", label: "أسبوعي" }]} />
          <Input label="مبلغ الاشتراك" type="number" value={subscriptionChange.subscriptionAmount} onChange={(subscriptionAmount) => setSubscriptionChange({ ...subscriptionChange, subscriptionAmount })} required />
          <Input label="فترة الاشتراك" value={subscriptionChange.currentPeriod} onChange={(currentPeriod) => setSubscriptionChange({ ...subscriptionChange, currentPeriod })} required />
          <Input label="سبب التغيير" value={subscriptionChange.reason} onChange={(reason) => setSubscriptionChange({ ...subscriptionChange, reason })} required />
          <Button type="submit" loading={submitting}>حفظ التغيير</Button>
        </form>
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-border p-3"><h3 className="mb-3 font-semibold">{title}</h3>{children}</section>;
}

function Summary({ title, value }: { title: string; value: string | number }) {
  return <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted">{title}</p><p className="font-semibold">{value}</p></div>;
}

function Input({ label, value, onChange, type = "text", required = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; disabled?: boolean }) {
  return <label className="block text-sm font-medium">{label}<input className="input-field mt-1 !py-2" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} /></label>;
}

function Select({ label, value, onChange, options, required = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; required?: boolean }) {
  return <label className="block text-sm font-medium">{label}<select className="input-field mt-1 !py-2" value={value} onChange={(e) => onChange(e.target.value)} required={required}><option value="">اختر</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
