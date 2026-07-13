"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, ReceiptText } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import ApiErrorAlert from "@/components/ui/ApiErrorAlert";
import StatCard from "@/components/finance/StatCard";
import { formatCurrency, formatDate } from "@/lib/finance-labels";

interface Profile {
  studentId: string;
  studentName: string;
  phone: string;
  academicLevel: string;
  totalAmountDue: number;
  totalAmountPaid: number;
  remainingBalance: number;
  overdueBalance: number;
  financialStatus: string;
  registeredCourses: { title: string }[];
}

interface Charge {
  _id: string;
  studentId: string;
  studentName?: string;
  courseTitle?: string;
  chargeType: string;
  description: string;
  finalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate: string;
  status: string;
}

interface Payment {
  _id: string;
  studentId: string;
  studentName?: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  receiptNumber: string;
  status: string;
}

interface StudentOption {
  _id: string;
  name: string;
  phone?: string;
}

interface CourseOption {
  _id: string;
  title: string;
}

const emptyCharge = {
  studentId: "",
  courseId: "",
  chargeType: "course",
  description: "",
  originalAmount: "",
  discountAmount: "0",
  dueDate: new Date().toISOString().slice(0, 10),
  academicSeason: "",
  notes: "",
};

const emptyPayment = {
  studentId: "",
  amount: "",
  paymentMethod: "cash",
  paymentDate: new Date().toISOString().slice(0, 10),
  academicSeason: "",
  paymentReference: "",
  notes: "",
};

const emptyDiscount = {
  studentId: "",
  chargeId: "",
  type: "fixed",
  value: "",
  percentage: "",
  reason: "",
  effectiveDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

const emptyRefund = {
  paymentId: "",
  refundAmount: "",
  refundMethod: "cash",
  refundDate: new Date().toISOString().slice(0, 10),
  reason: "",
  notes: "",
};

const emptyInstallment = {
  studentId: "",
  chargeIds: "",
  totalAmount: "",
  numberOfInstallments: "3",
  firstDueDate: new Date().toISOString().slice(0, 10),
  academicSeason: "",
  notes: "",
};

const statusLabels: Record<string, string> = {
  paid: "مدفوع",
  partially_paid: "مدفوع جزئيا",
  unpaid: "غير مدفوع",
  overdue: "متأخر",
  exempted: "معفى",
  refunded: "مسترجع",
  cancelled: "ملغى",
};

export default function StudentFinanceTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasPrev: false, hasNext: false });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"" | "charge" | "payment" | "discount" | "refund" | "installment">("");
  const [chargeForm, setChargeForm] = useState(emptyCharge);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [discountForm, setDiscountForm] = useState(emptyDiscount);
  const [refundForm, setRefundForm] = useState(emptyRefund);
  const [installmentForm, setInstallmentForm] = useState(emptyInstallment);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) params.set("search", search);
    const [profileRes, chargeRes, paymentRes, studentRes, courseRes, statsRes] = await Promise.all([
      fetch(`/api/admin/student-finance/profiles?${params}`),
      fetch("/api/admin/student-finance/charges?limit=10"),
      fetch("/api/admin/student-finance/payments?limit=10"),
      fetch("/api/admin/students?limit=500"),
      fetch("/api/admin/courses?limit=500"),
      fetch("/api/admin/student-finance/stats"),
    ]);
    const [profileData, chargeData, paymentData, studentData, courseData, statsData] = await Promise.all([
      profileRes.json(),
      chargeRes.json(),
      paymentRes.json(),
      studentRes.json(),
      courseRes.json(),
      statsRes.json(),
    ]);
    setProfiles(profileData.profiles || []);
    if (profileData.pagination) setPagination(profileData.pagination);
    setCharges(chargeData.charges || []);
    setPayments(paymentData.payments || []);
    setStudents(studentData.students || []);
    setCourses(courseData.courses || []);
    setStats(statsData.stats || null);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    let active = true;
    (async () => {
      await loadAll();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
  }, [loadAll]);

  function openModal(name: typeof modal) {
    setError("");
    setModal(name);
  }

  async function postJson(url: string, body: object) {
    setError("");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "حدث خطأ");
      return false;
    }
    setModal("");
    await loadAll();
    return true;
  }

  async function submitCharge(e: React.FormEvent) {
    e.preventDefault();
    await postJson("/api/admin/student-finance/charges", {
      ...chargeForm,
      originalAmount: Number(chargeForm.originalAmount),
      discountAmount: Number(chargeForm.discountAmount || 0),
    });
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    await postJson("/api/admin/student-finance/payments", {
      ...paymentForm,
      amount: Number(paymentForm.amount),
    });
  }

  async function submitDiscount(e: React.FormEvent) {
    e.preventDefault();
    await postJson("/api/admin/student-finance/discounts", {
      ...discountForm,
      value: discountForm.value ? Number(discountForm.value) : undefined,
      percentage: discountForm.percentage ? Number(discountForm.percentage) : undefined,
    });
  }

  async function submitRefund(e: React.FormEvent) {
    e.preventDefault();
    await postJson("/api/admin/student-finance/refunds", {
      ...refundForm,
      originalPaymentId: refundForm.paymentId,
      refundAmount: Number(refundForm.refundAmount),
    });
  }

  async function submitInstallment(e: React.FormEvent) {
    e.preventDefault();
    const first = new Date(installmentForm.firstDueDate);
    const count = Number(installmentForm.numberOfInstallments);
    const dueDates = Array.from({ length: count }).map((_, index) => {
      const date = new Date(first);
      date.setMonth(first.getMonth() + index);
      return date.toISOString().slice(0, 10);
    });
    await postJson("/api/admin/student-finance/installments", {
      ...installmentForm,
      totalAmount: Number(installmentForm.totalAmount),
      numberOfInstallments: count,
      dueDates,
      chargeIds: installmentForm.chargeIds.split(",").map((id) => id.trim()).filter(Boolean),
    });
  }

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid gap-3 md:grid-cols-4">
          <StatCard title="إجمالي الرسوم" value={stats.totalStudentCharges || 0} />
          <StatCard title="المحصّل" value={stats.totalCollectedAmount || 0} variant="success" />
          <StatCard title="الرصيد المتبقي" value={stats.totalOutstandingBalance || 0} />
          <StatCard title="المتأخر" value={stats.totalOverdueAmount || 0} variant="danger" />
          <StatCard title="دفعات اليوم" value={stats.paymentsToday || 0} />
          <StatCard title="دفعات الشهر" value={stats.paymentsThisMonth || 0} />
          <StatCard title="التخفيضات" value={stats.discountsTotal || 0} />
          <StatCard title="الاسترجاعات" value={stats.refundsTotal || 0} variant="danger" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input className="input-field max-w-sm" placeholder="بحث بالطالب أو الهاتف أو الكود" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
        <Button variant="outline" onClick={loadAll}><RefreshCw className="h-4 w-4" /> تحديث</Button>
        <Button onClick={() => openModal("charge")}><Plus className="h-4 w-4" /> رسم</Button>
        <Button onClick={() => openModal("payment")}><ReceiptText className="h-4 w-4" /> دفع</Button>
        <Button variant="outline" onClick={() => openModal("discount")}>تخفيض/إعفاء</Button>
        <Button variant="outline" onClick={() => openModal("refund")}>استرجاع</Button>
        <Button variant="outline" onClick={() => openModal("installment")}>تقسيط</Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted">جاري التحميل...</p>
      ) : profiles.length === 0 ? (
        <EmptyState title="لا توجد ملفات مالية" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-pink-50 text-muted">
                <tr>
                  <th className="p-3 text-start">الطالب</th>
                  <th className="p-3 text-start">المستوى</th>
                  <th className="p-3 text-start">الدورات</th>
                  <th className="p-3 text-start">المستحق</th>
                  <th className="p-3 text-start">المدفوع</th>
                  <th className="p-3 text-start">الرصيد</th>
                  <th className="p-3 text-start">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.studentId} className="border-t border-border">
                    <td className="p-3">
                      <p className="font-medium">{profile.studentName}</p>
                      <p className="text-xs text-muted">{profile.phone}</p>
                    </td>
                    <td className="p-3">{profile.academicLevel || "-"}</td>
                    <td className="p-3">{profile.registeredCourses.map((course) => course.title).filter(Boolean).join(", ") || "-"}</td>
                    <td className="p-3">{formatCurrency(profile.totalAmountDue)}</td>
                    <td className="p-3 text-emerald-700">{formatCurrency(profile.totalAmountPaid)}</td>
                    <td className="p-3 text-amber-700">{formatCurrency(profile.remainingBalance)}</td>
                    <td className="p-3">{statusLabels[profile.financialStatus] || profile.financialStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} onPageChange={setPage} />
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 font-bold">آخر الرسوم</h3>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <tbody>
                {charges.map((charge) => (
                  <tr key={charge._id} className="border-b border-border">
                    <td className="p-3">{charge.studentName || "-"}</td>
                    <td className="p-3">{charge.description}</td>
                    <td className="p-3">{formatCurrency(charge.balance)}</td>
                    <td className="p-3">{formatDate(charge.dueDate)}</td>
                    <td className="p-3">{charge.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h3 className="mb-2 font-bold">آخر الدفعات</h3>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment._id} className="border-b border-border">
                    <td className="p-3">{payment.studentName || "-"}</td>
                    <td className="p-3">{payment.receiptNumber}</td>
                    <td className="p-3">{formatCurrency(payment.amount)}</td>
                    <td className="p-3">{formatDate(payment.paymentDate)}</td>
                    <td className="p-3">{payment.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={modal === "charge"} onClose={() => setModal("")} title="إضافة رسم طالب" size="lg">
        <form onSubmit={submitCharge} className="space-y-3">
          <ApiErrorAlert error={error} />
          <StudentSelect value={chargeForm.studentId} students={students} onChange={(studentId) => setChargeForm({ ...chargeForm, studentId })} />
          <CourseSelect value={chargeForm.courseId} courses={courses} onChange={(courseId) => setChargeForm({ ...chargeForm, courseId })} />
          <InputField label="الوصف" value={chargeForm.description} onChange={(description) => setChargeForm({ ...chargeForm, description })} required />
          <div className="grid gap-3 md:grid-cols-3">
            <InputField label="المبلغ" type="number" value={chargeForm.originalAmount} onChange={(originalAmount) => setChargeForm({ ...chargeForm, originalAmount })} required />
            <InputField label="التخفيض" type="number" value={chargeForm.discountAmount} onChange={(discountAmount) => setChargeForm({ ...chargeForm, discountAmount })} />
            <InputField label="تاريخ الاستحقاق" type="date" value={chargeForm.dueDate} onChange={(dueDate) => setChargeForm({ ...chargeForm, dueDate })} required />
          </div>
          <Button type="submit" fullWidth>حفظ الرسم</Button>
        </form>
      </Modal>

      <Modal open={modal === "payment"} onClose={() => setModal("")} title="تسجيل دفعة طالب" size="lg">
        <form onSubmit={submitPayment} className="space-y-3">
          <ApiErrorAlert error={error} />
          <StudentSelect value={paymentForm.studentId} students={students} onChange={(studentId) => setPaymentForm({ ...paymentForm, studentId })} />
          <div className="grid gap-3 md:grid-cols-3">
            <InputField label="المبلغ" type="number" value={paymentForm.amount} onChange={(amount) => setPaymentForm({ ...paymentForm, amount })} required />
            <InputField label="تاريخ الدفع" type="date" value={paymentForm.paymentDate} onChange={(paymentDate) => setPaymentForm({ ...paymentForm, paymentDate })} required />
            <SelectField label="طريقة الدفع" value={paymentForm.paymentMethod} onChange={(paymentMethod) => setPaymentForm({ ...paymentForm, paymentMethod })} options={["cash", "bank_transfer", "card", "online_payment", "baridimob", "other"]} />
          </div>
          <InputField label="مرجع الدفع" value={paymentForm.paymentReference} onChange={(paymentReference) => setPaymentForm({ ...paymentForm, paymentReference })} />
          <Button type="submit" fullWidth>تسجيل الدفع</Button>
        </form>
      </Modal>

      <Modal open={modal === "discount"} onClose={() => setModal("")} title="تخفيض أو إعفاء" size="lg">
        <form onSubmit={submitDiscount} className="space-y-3">
          <ApiErrorAlert error={error} />
          <StudentSelect value={discountForm.studentId} students={students} onChange={(studentId) => setDiscountForm({ ...discountForm, studentId })} />
          <SelectField label="النوع" value={discountForm.type} onChange={(type) => setDiscountForm({ ...discountForm, type })} options={["fixed", "percentage", "full_exemption", "partial_exemption", "scholarship", "sibling", "promotional", "manual"]} />
          <InputField label="معرف الرسم" value={discountForm.chargeId} onChange={(chargeId) => setDiscountForm({ ...discountForm, chargeId })} required />
          <InputField label="القيمة" type="number" value={discountForm.value} onChange={(value) => setDiscountForm({ ...discountForm, value })} />
          <InputField label="النسبة" type="number" value={discountForm.percentage} onChange={(percentage) => setDiscountForm({ ...discountForm, percentage })} />
          <InputField label="السبب" value={discountForm.reason} onChange={(reason) => setDiscountForm({ ...discountForm, reason })} required />
          <Button type="submit" fullWidth>تطبيق</Button>
        </form>
      </Modal>

      <Modal open={modal === "refund"} onClose={() => setModal("")} title="استرجاع دفعة" size="lg">
        <form onSubmit={submitRefund} className="space-y-3">
          <ApiErrorAlert error={error} />
          <SelectField label="الدفع الأصلي" value={refundForm.paymentId} onChange={(paymentId) => setRefundForm({ ...refundForm, paymentId })} options={payments.map((payment) => payment._id)} labels={Object.fromEntries(payments.map((payment) => [payment._id, `${payment.receiptNumber} - ${formatCurrency(payment.amount)}`]))} />
          <InputField label="مبلغ الاسترجاع" type="number" value={refundForm.refundAmount} onChange={(refundAmount) => setRefundForm({ ...refundForm, refundAmount })} required />
          <InputField label="السبب" value={refundForm.reason} onChange={(reason) => setRefundForm({ ...refundForm, reason })} required />
          <Button type="submit" fullWidth>استرجاع</Button>
        </form>
      </Modal>

      <Modal open={modal === "installment"} onClose={() => setModal("")} title="خطة تقسيط" size="lg">
        <form onSubmit={submitInstallment} className="space-y-3">
          <ApiErrorAlert error={error} />
          <StudentSelect value={installmentForm.studentId} students={students} onChange={(studentId) => setInstallmentForm({ ...installmentForm, studentId })} />
          <InputField label="معرفات الرسوم مفصولة بفواصل" value={installmentForm.chargeIds} onChange={(chargeIds) => setInstallmentForm({ ...installmentForm, chargeIds })} />
          <div className="grid gap-3 md:grid-cols-3">
            <InputField label="الإجمالي" type="number" value={installmentForm.totalAmount} onChange={(totalAmount) => setInstallmentForm({ ...installmentForm, totalAmount })} required />
            <InputField label="عدد الأقساط" type="number" value={installmentForm.numberOfInstallments} onChange={(numberOfInstallments) => setInstallmentForm({ ...installmentForm, numberOfInstallments })} required />
            <InputField label="أول استحقاق" type="date" value={installmentForm.firstDueDate} onChange={(firstDueDate) => setInstallmentForm({ ...installmentForm, firstDueDate })} required />
          </div>
          <Button type="submit" fullWidth>إنشاء الخطة</Button>
        </form>
      </Modal>
    </div>
  );
}

function StudentSelect({ value, students, onChange }: { value: string; students: StudentOption[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">الطالب</label>
      <select className="input-field w-full" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">اختر الطالب</option>
        {students.map((student) => (
          <option key={student._id} value={student._id}>{student.name} - {student.phone}</option>
        ))}
      </select>
    </div>
  );
}

function CourseSelect({ value, courses, onChange }: { value: string; courses: CourseOption[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">الدورة</label>
      <select className="input-field w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">بدون دورة</option>
        {courses.map((course) => (
          <option key={course._id} value={course._id}>{course.title}</option>
        ))}
      </select>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input className="input-field w-full" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <select className="input-field w-full" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">اختر</option>
        {options.map((option) => (
          <option key={option} value={option}>{labels[option] || option}</option>
        ))}
      </select>
    </div>
  );
}
