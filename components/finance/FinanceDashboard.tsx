"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import Title from "@/components/ui/Title";
import FinanceOverview from "./FinanceOverview";
import PaymentsTab from "./PaymentsTab";
import ExpensesTab from "./ExpensesTab";
import PayoutsTab from "./PayoutsTab";
import ReportsTab from "./ReportsTab";
import CashboxTab from "./CashboxTab";
import LessonInvoicesTab from "./LessonInvoicesTab";
import TeacherAccountTab from "./TeacherAccountTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "cashbox", label: "الصندوق" },
  { id: "lesson-invoices", label: "الحصص والفواتير" },
  { id: "teacher-account", label: "حساب الأستاذ" },
  { id: "payments", label: "المدفوعات" },
  { id: "expenses", label: "المصاريف" },
  { id: "payouts", label: "مستحقات الأساتذة" },
  { id: "reports", label: "التقارير" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function FinanceDashboard() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div>
      <Title
        title="الحسابات والمالية"
        subtitle="إدارة المدفوعات والمصاريف ومستحقات الأساتذة والتقارير المالية"
        className="mb-6"
      />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              tab === t.id
                ? "bg-primary text-white"
                : "text-muted hover:bg-pink-50 hover:text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <FinanceOverview />}
      {tab === "cashbox" && <CashboxTab />}
      {tab === "lesson-invoices" && <LessonInvoicesTab />}
      {tab === "teacher-account" && <TeacherAccountTab />}
      {tab === "payments" && <PaymentsTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "payouts" && <PayoutsTab />}
      {tab === "reports" && <ReportsTab />}
    </div>
  );
}
