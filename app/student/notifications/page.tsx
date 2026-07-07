"use client";

import { Bell, CheckCheck } from "lucide-react";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { mockNotifications } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function StudentNotificationsPage() {
  return (
    <div>
      <Title title="الإشعارات" subtitle="تابع آخر التحديثات والتنبيهات" className="mb-8" />

      <div className="space-y-3">
        {mockNotifications.map((notif) => (
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
    </div>
  );
}
