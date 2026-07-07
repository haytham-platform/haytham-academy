"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { TRANSPORT_STATUS_LABELS } from "@/lib/transport-labels";
import { formatDate } from "@/lib/finance-labels";

interface TransportData {
  hasTransport: boolean;
  subscription: {
    busId?: {
      busName?: string;
      routeId?: { name?: string; description?: string };
      driverId?: { name?: string; phone?: string };
    };
    pickupPoint?: string;
    dropoffPoint?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    notes?: string;
  } | null;
}

export default function StudentTransportWidget() {
  const [data, setData] = useState<TransportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/student/transport")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("فشل تحميل بيانات النقل"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <h2 className="mb-4 font-bold">النقل</h2>
        <p className="text-sm text-muted">جاري التحميل...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <h2 className="mb-4 font-bold">النقل</h2>
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  if (!data?.hasTransport || !data.subscription) {
    return (
      <Card>
        <h2 className="mb-4 font-bold">النقل</h2>
        <EmptyState title="غير مسجل" description="لم تسجل في خدمة النقل بعد" />
      </Card>
    );
  }

  const sub = data.subscription;
  const bus = sub.busId;

  return (
    <Card>
      <h2 className="mb-4 font-bold">النقل المجاني</h2>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><span className="text-muted">الحافلة:</span> {bus?.busName ?? "—"}</div>
        <div><span className="text-muted">خط السير:</span> {bus?.routeId?.name ?? "—"}</div>
        <div><span className="text-muted">السائق:</span> {bus?.driverId?.name ?? "—"}</div>
        <div><span className="text-muted">نقطة الصعود:</span> {sub.pickupPoint ?? "—"}</div>
        <div><span className="text-muted">نقطة النزول:</span> {sub.dropoffPoint ?? "—"}</div>
        <div><span className="text-muted">من:</span> {sub.startDate ? formatDate(sub.startDate) : "—"}</div>
        <div><span className="text-muted">إلى:</span> {sub.endDate ? formatDate(sub.endDate) : "—"}</div>
        <div>
          <span className="text-muted">الحالة:</span>{" "}
          {TRANSPORT_STATUS_LABELS[sub.status as keyof typeof TRANSPORT_STATUS_LABELS] ?? sub.status}
        </div>
      </div>
    </Card>
  );
}
