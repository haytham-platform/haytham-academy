"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import {
  createTeacherInvoiceDocument,
  createTeacherPaymentDocument,
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
} from "@/lib/finance-labels";
import EmptyState from "@/components/ui/EmptyState";
import { parseDecimal, round2 } from "@/lib/decimal";

interface TeacherOption {
  _id: string;
  name: string;
  subject: string;
}

interface TeacherAccount {
  teacher: {
    _id: string;
    name: string;
    subject: string;
    adminShare: number;
    teacherShare: number;
  };
  sessionCounts: {
    one: number;
    two: number;
    three: number;
    four: number;
  };
  totalStudents: number;
  totalRevenue: number;
  adminShareAmount: number;
  teacherShareAmount: number;
  invoices: {
    _id: string;
    studentName?: string;
    sessionCount: number;
    totalAmount: number;
    paymentStatus: string;
    invoiceDate: string;
  }[];
  teacherInvoices: {
    _id: string;
    courseTitle?: string;
    invoicePeriod?: string;
    numberOfSessions: number;
    sessionRate: number;
    grossAmount: number;
    administrationShare: number;
    teacherShareAmount?: number;
    netTeacherAmount: number;
    paid: number;
    remaining: number;
    paymentStatus: string;
    payoutDate: string;
    note?: string;
    createdBy?: string;
  }[];
  teacherPayments: TeacherPayment[];
  outstandingTeacherInvoices: number;
  month: string | null;
}

interface TeacherPayment {
  _id: string;
  receiptNumber: string;
  teacherName?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  accountType: "cash" | "bank";
  accountName?: string;
  referenceNumber?: string;
  notes?: string;
  receiptAttachment?: string;
  allocations: {
    invoiceId: string;
    amount: number;
    invoicePeriod?: string;
    courseTitle?: string;
  }[];
  grossEarnings: number;
  administrationShare: number;
  teacherNetAmount: number;
  previouslyPaidAmount: number;
  remainingBeforePayment: number;
  remainingAfterPayment: number;
  status: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdBy?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

function emptyPaymentForm() {
  return {
    amount: "",
    paymentDate: today(),
    paymentMethod: "cash",
    accountType: "cash",
    accountName: "",
    referenceNumber: "",
    notes: "",
    receiptAttachment: "",
    invoiceIds: [] as string[],
  };
}

export default function TeacherAccountTab() {
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [month, setMonth] = useState("");
  const [account, setAccount] = useState<TeacherAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<TeacherPayment | null>(null);
  const [cancelPayment, setCancelPayment] = useState<TeacherPayment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [viewingDocument, setViewingDocument] = useState<FinancialDocumentData | null>(null);

  const payableInvoices = useMemo(
    () => (account?.teacherInvoices || []).filter((invoice) => invoice.remaining > 0),
    [account]
  );
  const selectedInvoices = useMemo(
    () => payableInvoices.filter((invoice) => paymentForm.invoiceIds.includes(invoice._id)),
    [payableInvoices, paymentForm.invoiceIds]
  );
  const paymentSummary = useMemo(() => {
    const gross = round2(selectedInvoices.reduce((sum, invoice) => sum + (invoice.grossAmount || 0), 0));
    const admin = round2(selectedInvoices.reduce((sum, invoice) => sum + (invoice.administrationShare || 0), 0));
    const net = round2(selectedInvoices.reduce((sum, invoice) => sum + (invoice.netTeacherAmount || 0), 0));
    const paid = round2(selectedInvoices.reduce((sum, invoice) => sum + (invoice.paid || 0), 0));
    const remaining = round2(selectedInvoices.reduce((sum, invoice) => sum + (invoice.remaining || 0), 0));
    const amount = round2(parseDecimal(paymentForm.amount));
    return {
      gross,
      admin,
      net,
      paid,
      remaining,
      amount,
      after: round2(Math.max(0, remaining - amount)),
    };
  }, [selectedInvoices, paymentForm.amount]);

  useEffect(() => {
    fetch("/api/admin/teachers?limit=500")
      .then((r) => r.json())
      .then((d) => setTeachers(d.teachers || []));
  }, []);

  useEffect(() => {
    if (!teacherId) return;

    let active = true;

    (async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({ teacherId });
      if (month) params.set("month", month);

      try {
        const res = await fetch(`/api/admin/finance/teacher-account?${params}`);
        const d = await res.json();
        if (!active) return;
        if (d.error) {
          setError(d.error as string);
          setAccount(null);
        } else {
          setAccount(d as TeacherAccount);
        }
      } catch {
        if (active) {
          setError("حدث خطأ أثناء جلب البيانات");
          setAccount(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [teacherId, month, refreshKey]);

  function openPaymentModal() {
    const invoiceIds = payableInvoices.map((invoice) => invoice._id);
    const amount = round2(payableInvoices.reduce((sum, invoice) => sum + (invoice.remaining || 0), 0));
    setPaymentForm({
      ...emptyPaymentForm(),
      amount: amount > 0 ? amount.toFixed(2) : "",
      invoiceIds,
    });
    setError("");
    setPaymentOpen(true);
  }

  function togglePaymentInvoice(invoiceId: string) {
    const selected = paymentForm.invoiceIds.includes(invoiceId)
      ? paymentForm.invoiceIds.filter((id) => id !== invoiceId)
      : [...paymentForm.invoiceIds, invoiceId];
    const amount = round2(
      payableInvoices
        .filter((invoice) => selected.includes(invoice._id))
        .reduce((sum, invoice) => sum + (invoice.remaining || 0), 0)
    );
    setPaymentForm({
      ...paymentForm,
      invoiceIds: selected,
      amount: amount > 0 ? amount.toFixed(2) : "",
    });
  }

  async function submitTeacherPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!teacherId || submittingPayment) return;
    setError("");
    const amount = round2(parseDecimal(paymentForm.amount));
    if (amount <= 0) {
      setError("مبلغ الدفع يجب أن يكون أكبر من صفر");
      return;
    }
    if (amount > paymentSummary.remaining + 0.01) {
      setError("مبلغ الدفع أكبر من الرصيد المتبقي للأستاذ");
      return;
    }
    if (!paymentForm.invoiceIds.length) {
      setError("يجب اختيار الفواتير المرتبطة بالدفع");
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await fetch("/api/admin/finance/teacher-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          invoiceIds: paymentForm.invoiceIds,
          amount,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          accountType: paymentForm.accountType,
          accountName: paymentForm.accountName.trim(),
          referenceNumber: paymentForm.referenceNumber.trim(),
          notes: paymentForm.notes.trim(),
          receiptAttachment: paymentForm.receiptAttachment.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذر تسجيل دفع الأستاذ");
        return;
      }
      setMessage("تم تسجيل دفع الأستاذ وتحديث الأرصدة");
      setPaymentOpen(false);
      setRefreshKey((value) => value + 1);
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function submitCancelPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelPayment || !cancelReason.trim()) return;
    setError("");
    const res = await fetch(`/api/admin/finance/teacher-payments/${cancelPayment._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reason: cancelReason.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "تعذر إلغاء الدفع");
      return;
    }
    setMessage("تم إلغاء الدفع وإعادة احتساب الأرصدة");
    setCancelPayment(null);
    setCancelReason("");
    setRefreshKey((value) => value + 1);
  }

  function toTeacherInvoiceDocument(invoice: TeacherAccount["teacherInvoices"][number]) {
    return createTeacherInvoiceDocument({
      ...invoice,
      teacherName: account?.teacher.name,
      subject: account?.teacher.subject,
    });
  }

  function toTeacherPaymentDocument(payment: TeacherPayment) {
    return createTeacherPaymentDocument(payment);
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">حساب الأستاذ</h2>
        <p className="text-sm text-muted">حساب المداخيل وحصة الإدارة والأستاذ من الفواتير المسجلة</p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">الأستاذ</label>
          <select className="input-field" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— اختر الأستاذ —</option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>{t.name} — {t.subject}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">الشهر (اختياري)</label>
          <input type="month" className="input-field" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      {message && <div className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!teacherId ? (
        <EmptyState title="اختر أستاذاً" description="حدد الأستاذ لعرض حسابه المالي" />
      ) : loading ? (
        <p className="text-muted">جاري الحساب...</p>
      ) : account ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="اسم الأستاذ" value={account.teacher.name} />
            <StatCard label="المادة" value={account.teacher.subject} />
            <StatCard label="نسبة الإدارة" value={`${account.teacher.adminShare}%`} />
            <StatCard label="نسبة الأستاذ" value={`${account.teacher.teacherShare}%`} />
          </div>

          <div className="rounded-2xl border border-border p-4">
            <h3 className="mb-3 font-bold">توزيع التلاميذ حسب عدد الحصص</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="حصة واحدة" value={String(account.sessionCounts.one)} small />
              <StatCard label="حصتان" value={String(account.sessionCounts.two)} small />
              <StatCard label="3 حصص" value={String(account.sessionCounts.three)} small />
              <StatCard label="4 حصص" value={String(account.sessionCounts.four)} small />
              <StatCard label="مجموع التلاميذ" value={String(account.totalStudents)} small highlight />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="مجموع المداخيل" value={formatCurrency(account.totalRevenue)} highlight />
            <StatCard label="حصة الإدارة" value={formatCurrency(account.adminShareAmount)} />
            <StatCard label="حصة الأستاذ" value={formatCurrency(account.teacherShareAmount)} />
          </div>

          <div className="rounded-2xl border border-border p-4">
            <h3 className="mb-3 font-bold">فواتير الأستاذ</h3>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 p-4">
              <div>
                <h3 className="font-bold">تسوية دفع الأستاذ</h3>
                <p className="text-sm text-muted">المتبقي غير المدفوع: {formatCurrency(account.outstandingTeacherInvoices || 0)}</p>
              </div>
              <Button type="button" onClick={openPaymentModal} disabled={!payableInvoices.length}>
                دفع الأستاذ
              </Button>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <StatCard label="عدد الفواتير" value={String(account.teacherInvoices?.length || 0)} small />
              <StatCard
                label="إجمالي الصافي"
                value={formatCurrency((account.teacherInvoices || []).reduce((sum, inv) => sum + (inv.netTeacherAmount || 0), 0))}
                small
              />
              <StatCard label="المتبقي للأستاذ" value={formatCurrency(account.outstandingTeacherInvoices || 0)} small highlight />
            </div>
            {account.teacherInvoices?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-right">
                      <th className="p-3">الدورة</th>
                      <th className="p-3">الفترة</th>
                      <th className="p-3">الحصص</th>
                      <th className="p-3">الإجمالي</th>
                      <th className="p-3">حصة الإدارة</th>
                      <th className="p-3">صافي الأستاذ</th>
                      <th className="p-3">المدفوع</th>
                      <th className="p-3">المتبقي</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.teacherInvoices.map((inv) => (
                      <tr key={inv._id} className="border-b border-border">
                        <td className="p-3">{inv.courseTitle || "—"}</td>
                        <td className="p-3">{inv.invoicePeriod || "—"}</td>
                        <td className="p-3">{inv.numberOfSessions}</td>
                        <td className="p-3">{formatCurrency(inv.grossAmount || 0)}</td>
                        <td className="p-3">{formatCurrency(inv.administrationShare || 0)}</td>
                        <td className="p-3">{formatCurrency(inv.netTeacherAmount || 0)}</td>
                        <td className="p-3">{formatCurrency(inv.paid || 0)}</td>
                        <td className="p-3">{formatCurrency(inv.remaining || 0)}</td>
                        <td className="p-3">{labelOf(LESSON_PAYMENT_STATUSES, inv.paymentStatus || "unpaid")}</td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <DocumentActionButtons
                              document={toTeacherInvoiceDocument(inv)}
                              onView={setViewingDocument}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="لا توجد فواتير أستاذ" description="لا توجد فواتير أستاذ مسجلة لهذه الفترة" />
            )}
          </div>

          <div className="rounded-2xl border border-border p-4">
            <h3 className="mb-3 font-bold">سجل دفعات الأستاذ</h3>
            {account.teacherPayments?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-right">
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">طريقة الدفع</th>
                      <th className="p-3">المرجع</th>
                      <th className="p-3">الفواتير</th>
                      <th className="p-3">سجل بواسطة</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.teacherPayments.map((payment) => (
                      <tr key={payment._id} className="border-b border-border">
                        <td className="p-3">{formatDate(payment.paymentDate)}</td>
                        <td className="p-3 font-bold">{formatCurrency(payment.amount)}</td>
                        <td className="p-3">{labelOf(PAYMENT_METHODS, payment.paymentMethod)}</td>
                        <td className="p-3">{payment.referenceNumber || payment.receiptNumber}</td>
                        <td className="p-3">{payment.allocations.length}</td>
                        <td className="p-3">{payment.createdBy || "—"}</td>
                        <td className="p-3">
                          <span className={`badge ${payment.status === "active" ? "badge-active" : "badge-inactive"}`}>
                            {payment.status === "active" ? "نشط" : "ملغى"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <DocumentActionButtons
                              document={toTeacherPaymentDocument(payment)}
                              onView={setViewingDocument}
                            />
                            {payment.status === "active" && (
                              <button type="button" onClick={() => setCancelPayment(payment)} className="text-amber-700" title="إلغاء">
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="لا توجد دفعات أستاذ" description="لم يتم تسجيل دفعات لهذا الأستاذ بعد" />
            )}
          </div>

          {account.invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-bold">تفاصيل فواتير الطلاب{account.month ? ` — ${account.month}` : ""}</h3>
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-border text-right">
                    <th className="p-3">الطالب</th>
                    <th className="p-3">الحصص</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {account.invoices.map((inv) => (
                    <tr key={inv._id} className="border-b border-border">
                      <td className="p-3">{inv.studentName}</td>
                      <td className="p-3">{inv.sessionCount}</td>
                      <td className="p-3">{formatCurrency(inv.totalAmount)}</td>
                      <td className="p-3">{labelOf(LESSON_PAYMENT_STATUSES, inv.paymentStatus)}</td>
                      <td className="p-3">{new Date(inv.invoiceDate).toLocaleDateString("ar-DZ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="لا توجد فواتير طلاب" description="لا توجد فواتير طلاب مسجلة لهذا الأستاذ في الفترة المحددة" />
          )}
        </div>
      ) : null}

      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="دفع الأستاذ" size="lg">
        <form onSubmit={submitTeacherPayment} className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto px-1">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="grid gap-3 rounded-xl bg-pink-50/60 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryField label="الإجمالي" value={formatCurrency(paymentSummary.gross)} />
            <SummaryField label="حصة الإدارة" value={formatCurrency(paymentSummary.admin)} />
            <SummaryField label="صافي الأستاذ" value={formatCurrency(paymentSummary.net)} />
            <SummaryField label="مدفوع سابقاً" value={formatCurrency(paymentSummary.paid)} />
            <SummaryField label="المتبقي" value={formatCurrency(paymentSummary.remaining)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="مبلغ الدفع" type="text" inputMode="decimal" min="0" step="0.01" required value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
            <Input label="تاريخ الدفع" type="date" required value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} />
            <SelectField label="طريقة الدفع" value={paymentForm.paymentMethod} onChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </SelectField>
            <SelectField label="الصندوق / الحساب" value={paymentForm.accountType} onChange={(value) => setPaymentForm({ ...paymentForm, accountType: value })}>
              <option value="cash">الصندوق النقدي</option>
              <option value="bank">حساب بنكي</option>
            </SelectField>
            <Input label="اسم الحساب" value={paymentForm.accountName} onChange={(e) => setPaymentForm({ ...paymentForm, accountName: e.target.value })} />
            <Input label="رقم المرجع" value={paymentForm.referenceNumber} onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })} />
            <Input label="رابط المرفق (اختياري)" value={paymentForm.receiptAttachment} onChange={(e) => setPaymentForm({ ...paymentForm, receiptAttachment: e.target.value })} />
          </div>
          <div className="rounded-xl border border-border p-4">
            <h3 className="mb-3 font-bold">الفواتير المرتبطة</h3>
            <div className="space-y-2">
              {payableInvoices.map((invoice) => (
                <label key={invoice._id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={paymentForm.invoiceIds.includes(invoice._id)} onChange={() => togglePaymentInvoice(invoice._id)} />
                    <span>{invoice.courseTitle || "—"} — {invoice.invoicePeriod || "—"}</span>
                  </span>
                  <span className="font-semibold">{formatCurrency(invoice.remaining || 0)}</span>
                </label>
              ))}
            </div>
          </div>
          <TextArea label="ملاحظات" value={paymentForm.notes} onChange={(value) => setPaymentForm({ ...paymentForm, notes: value })} />
          <div className="sticky bottom-0 z-10 border-t border-border bg-white pt-4">
            <Button type="submit" fullWidth disabled={submittingPayment}>
              {submittingPayment ? "جاري التسجيل..." : "تأكيد الدفع"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(viewingDocument)} onClose={() => setViewingDocument(null)} title="عرض المستند" size="lg">
        {viewingDocument && <FinancialDocumentView document={viewingDocument} />}
      </Modal>

      <Modal open={Boolean(viewingPayment)} onClose={() => setViewingPayment(null)} title="تفاصيل دفع الأستاذ" size="lg">
        {viewingPayment && <PaymentReceipt payment={viewingPayment} />}
      </Modal>

      <Modal open={Boolean(cancelPayment)} onClose={() => setCancelPayment(null)} title="إلغاء دفع الأستاذ" size="md">
        <form onSubmit={submitCancelPayment} className="space-y-4">
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <p className="text-sm text-muted">سيتم عكس أثر الدفع وإعادة احتساب أرصدة الفواتير والصندوق.</p>
          <TextArea label="سبب الإلغاء" value={cancelReason} onChange={setCancelReason} />
          <Button type="submit" fullWidth disabled={!cancelReason.trim()}>
            تأكيد الإلغاء
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  small,
  highlight,
}: {
  label: string;
  value: string;
  small?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-border p-4 ${highlight ? "bg-primary/5" : "bg-white"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-bold ${small ? "text-lg" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <select className="input-field w-full" value={value} onChange={(e) => onChange(e.target.value)}>
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
      <textarea className="input-field w-full resize-none" rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
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

function PaymentReceipt({ payment }: { payment: TeacherPayment }) {
  return (
    <div id={`teacher-payment-${payment._id}`} className="space-y-4 print:text-black">
      <div className="text-center">
        <h3 className="text-lg font-bold">وصل دفع أستاذ</h3>
        <p className="text-sm text-muted">{payment.receiptNumber}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryField label="الأستاذ" value={payment.teacherName || "—"} />
        <SummaryField label="التاريخ" value={formatDate(payment.paymentDate)} />
        <SummaryField label="المبلغ" value={formatCurrency(payment.amount)} />
        <SummaryField label="طريقة الدفع" value={labelOf(PAYMENT_METHODS, payment.paymentMethod)} />
        <SummaryField label="الحساب" value={payment.accountType === "bank" ? payment.accountName || "حساب بنكي" : "الصندوق النقدي"} />
        <SummaryField label="المرجع" value={payment.referenceNumber || "—"} />
        <SummaryField label="الإجمالي" value={formatCurrency(payment.grossEarnings)} />
        <SummaryField label="حصة الإدارة" value={formatCurrency(payment.administrationShare)} />
        <SummaryField label="صافي الأستاذ" value={formatCurrency(payment.teacherNetAmount)} />
        <SummaryField label="مدفوع سابقاً" value={formatCurrency(payment.previouslyPaidAmount)} />
        <SummaryField label="المتبقي قبل الدفع" value={formatCurrency(payment.remainingBeforePayment)} />
        <SummaryField label="المتبقي بعد الدفع" value={formatCurrency(payment.remainingAfterPayment)} />
        <SummaryField label="سجل بواسطة" value={payment.createdBy || "—"} />
        <SummaryField label="الحالة" value={payment.status === "active" ? "نشط" : "ملغى"} />
      </div>
      <div className="rounded-xl border border-border p-4">
        <h4 className="mb-2 font-bold">الفواتير المرتبطة</h4>
        <div className="space-y-2 text-sm">
          {payment.allocations.map((allocation) => (
            <div key={`${allocation.invoiceId}-${allocation.amount}`} className="flex justify-between gap-3 border-b border-border pb-2">
              <span>{allocation.courseTitle || "—"} — {allocation.invoicePeriod || "—"}</span>
              <strong>{formatCurrency(allocation.amount)}</strong>
            </div>
          ))}
        </div>
      </div>
      {payment.receiptAttachment && (
        <a className="text-sm text-primary underline" href={payment.receiptAttachment} target="_blank" rel="noreferrer">
          عرض المرفق
        </a>
      )}
      {payment.notes && <p className="text-sm text-muted">{payment.notes}</p>}
      {payment.status === "cancelled" && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          ملغى: {payment.cancellationReason || "—"} {payment.cancelledAt ? `— ${formatDate(payment.cancelledAt)}` : ""}
        </div>
      )}
    </div>
  );
}
