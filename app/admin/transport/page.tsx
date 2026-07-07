"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import TransportNav from "@/components/transport/TransportNav";

export default function TransportOverviewPage() {
  const [stats, setStats] = useState({
    buses: 0,
    drivers: 0,
    routes: 0,
    subscriptions: 0,
    activePassengers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [buses, drivers, routes, subs] = await Promise.all([
        fetch("/api/admin/transport/buses?limit=1").then((r) => r.json()),
        fetch("/api/admin/transport/drivers?limit=1").then((r) => r.json()),
        fetch("/api/admin/transport/routes?limit=1").then((r) => r.json()),
        fetch("/api/admin/transport/subscriptions?limit=1&status=active").then((r) => r.json()),
      ]);
      if (active) {
        setStats({
          buses: buses.pagination?.total ?? buses.buses?.length ?? 0,
          drivers: drivers.pagination?.total ?? drivers.drivers?.length ?? 0,
          routes: routes.pagination?.total ?? routes.routes?.length ?? 0,
          subscriptions: subs.pagination?.total ?? subs.subscriptions?.length ?? 0,
          activePassengers: subs.pagination?.total ?? 0,
        });
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div>
      <Title
        title="إدارة النقل"
        subtitle="خدمة النقل المجانية — الحافلات والسائقون وتسجيل الطلاب"
        className="mb-6"
      />
      <TransportNav />

      <Card className="mb-6 border-primary/20 bg-primary/5">
        <p className="text-sm font-medium text-primary">النقل مجاني لجميع الطلاب المسجلين</p>
        <p className="mt-1 text-sm text-muted">لا توجد رسوم أو مدفوعات مرتبطة بخدمة النقل</p>
      </Card>

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><p className="text-sm text-muted">الحافلات</p><p className="text-2xl font-bold">{stats.buses}</p></Card>
          <Card><p className="text-sm text-muted">السائقون</p><p className="text-2xl font-bold">{stats.drivers}</p></Card>
          <Card><p className="text-sm text-muted">خطوط السير</p><p className="text-2xl font-bold">{stats.routes}</p></Card>
          <Card><p className="text-sm text-muted">اشتراكات نشطة</p><p className="text-2xl font-bold">{stats.subscriptions}</p></Card>
          <Card><p className="text-sm text-muted">ركاب حالياً</p><p className="text-2xl font-bold text-primary">{stats.activePassengers}</p></Card>
        </div>
      )}
    </div>
  );
}
