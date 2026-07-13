"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

interface StudentNotification {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/student/notifications");
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "حدث خطأ");
          return;
        }
        if (active) setNotifications(data.notifications || []);
      } catch {
        setError("حدث خطأ أثناء جلب الإشعارات");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <Title title="الإشعارات" subtitle="تابع آخر التحديثات والتنبيهات" className="mb-8" />

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted">جاري التحميل...</p>
      ) : notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card
              key={notif._id}
              className={!notif.read ? "border-primary/30 bg-blue-50/30" : ""}
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${notif.read ? "bg-gray-100" : "bg-primary text-white"}`}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{notif.title}</h3>
                    {!notif.read && <Badge variant="primary">جديد</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{notif.message}</p>
                  <p className="mt-2 text-xs text-muted">{formatDate(notif.createdAt)}</p>
                </div>
                {notif.read && (
                  <CheckCheck className="h-4 w-4 shrink-0 text-green-600" aria-label="مقروء" />
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted">لا توجد إشعارات حالياً</p>
      )}
    </div>
  );
}
