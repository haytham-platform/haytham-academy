"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { TRANSPORT_STATUS_LABELS } from "@/lib/transport-labels";
import { formatDate } from "@/lib/finance-labels";

interface TransportInfo {
  hasTransport: boolean;
  subscription: {
    busId?: {
      busName?: string;
      routeId?: { name?: string };
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

export default function StudentTransportSection({ studentId }: { studentId: string | null }) {
  const [data, setData] = useState<TransportInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    let active = true;
    fetch(`/api/admin/students/${studentId}/transport`)
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [studentId]);

  if (!studentId) return null;

  const bus = data?.subscription?.busId;

  return (
    <Card className="mt-6">
      <h3 className="mb-4 font-bold">النقل</h3>
      {loading ? (
        <p className="text-sm text-muted">جاري التحميل...</p>
      ) : !data?.hasTransport || !data.subscription ? (
        <p className="text-sm text-muted">الطالب غير مسجل في خدمة النقل</p>
      ) : (
        <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3">
          <div><span className="text-muted">مشترك:</span> نعم (مجاني)</div>
          <div><span className="text-muted">الحافلة:</span> {bus?.busName ?? "—"}</div>
          <div><span className="text-muted">خط السير:</span> {bus?.routeId?.name ?? "—"}</div>
          <div><span className="text-muted">السائق:</span> {bus?.driverId?.name ?? "—"}</div>
          <div><span className="text-muted">نقطة الصعود:</span> {data.subscription.pickupPoint}</div>
          <div><span className="text-muted">نقطة النزول:</span> {data.subscription.dropoffPoint}</div>
          <div><span className="text-muted">من:</span> {data.subscription.startDate ? formatDate(data.subscription.startDate) : "—"}</div>
          <div><span className="text-muted">إلى:</span> {data.subscription.endDate ? formatDate(data.subscription.endDate) : "—"}</div>
          <div><span className="text-muted">الحالة:</span> {TRANSPORT_STATUS_LABELS[data.subscription.status as keyof typeof TRANSPORT_STATUS_LABELS] ?? data.subscription.status}</div>
        </div>
      )}
    </Card>
  );
}
