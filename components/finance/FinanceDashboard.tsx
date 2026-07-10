"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { hasPermission, type Permission } from "@/lib/permissions";
import Title from "@/components/ui/Title";
import FinanceOverview from "./FinanceOverview";
import PaymentsTab from "./PaymentsTab";
import ExpensesTab from "./ExpensesTab";
import PayoutsTab from "./PayoutsTab";
import ReportsTab from "./ReportsTab";
import CashboxTab from "./CashboxTab";
import LessonInvoicesTab from "./LessonInvoicesTab";
import TeacherAccountTab from "./TeacherAccountTab";
import NotificationsTab from "./NotificationsTab";
import type { UserRole } from "@/types";

const TABS = [
  { id: "overview", label: "Overview", permission: "finance.view" },
  { id: "cashbox", label: "الصندوق", permission: "finance.cash" },
  { id: "lesson-invoices", label: "الحصص والفواتير", permission: "finance.payments" },
  { id: "teacher-account", label: "حساب الأستاذ", permission: "finance.payouts" },
  { id: "payments", label: "المدفوعات", permission: "finance.payments" },
  { id: "expenses", label: "المصاريف", permission: "finance.expenses" },
  { id: "payouts", label: "مستحقات الأساتذة", permission: "finance.payouts" },
  { id: "reports", label: "التقارير", permission: "finance.reports" },
  { id: "notifications", label: "الإشعارات", permission: "finance.view" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function FinanceDashboard() {
  const [tab, setTab] = useState<TabId>("overview");
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setRole(d.user?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  const visibleTabs = role
    ? TABS.filter((t) => hasPermission(role, t.permission as Permission))
    : TABS.filter((t) => t.id === "overview");
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : "overview";

  return (
    <div>
      <Title
        title="الحسابات والمالية"
        subtitle="إدارة المدفوعات والمصاريف ومستحقات الأساتذة والصندوق والتقارير المالية"
        className="mb-6"
      />

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-2">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              activeTab === t.id
                ? "bg-primary text-white"
                : "text-muted hover:bg-pink-50 hover:text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <FinanceOverview />}
      {activeTab === "cashbox" && <CashboxTab />}
      {activeTab === "lesson-invoices" && <LessonInvoicesTab />}
      {activeTab === "teacher-account" && <TeacherAccountTab />}
      {activeTab === "payments" && <PaymentsTab />}
      {activeTab === "expenses" && <ExpensesTab />}
      {activeTab === "payouts" && <PayoutsTab />}
      {activeTab === "reports" && <ReportsTab />}
      {activeTab === "notifications" && <NotificationsTab />}
    </div>
  );
}
