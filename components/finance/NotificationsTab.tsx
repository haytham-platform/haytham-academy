"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { formatDate } from "@/lib/finance-labels";

interface FinanceNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  readBy: string[];
  createdAt: string;
}

export default function NotificationsTab() {
  const [notifications, setNotifications] = useState<FinanceNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const res = await fetch("/api/admin/finance/notifications");
    const data = await res.json();
    setNotifications(data.notifications || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/finance/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setNotifications(data.notifications || []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const interval = window.setInterval(() => {
      if (active) loadNotifications();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  async function markRead(id: string) {
    await fetch(`/api/admin/finance/notifications/${id}/read`, { method: "POST" });
    loadNotifications();
  }

  if (loading) {
    return <p className="py-8 text-center text-muted">جاري التحميل...</p>;
  }

  return (
    <Card>
      <h3 className="mb-4 font-bold">الإشعارات المالية</h3>
      {notifications.length === 0 ? (
        <EmptyState title="لا توجد إشعارات مالية" />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div key={notification._id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{notification.title}</p>
                  <p className="mt-1 text-sm text-muted">{notification.message}</p>
                  <p className="mt-1 text-xs text-muted">{formatDate(notification.createdAt)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => markRead(notification._id)}>
                  تم الاطلاع
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
