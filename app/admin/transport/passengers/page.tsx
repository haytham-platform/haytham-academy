"use client";

import { useEffect, useState } from "react";
import Title from "@/components/ui/Title";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import TransportNav from "@/components/transport/TransportNav";
import { TRANSPORT_STATUS_LABELS } from "@/lib/transport-labels";
import { formatDate } from "@/lib/finance-labels";

interface BusOption {
  _id: string;
  busName: string;
  plateNumber: string;
  capacity: number;
  driverName?: string;
  routeName?: string;
}

interface Passenger {
  _id: string;
  studentId: { name?: string; phone?: string };
  pickupPoint: string;
  dropoffPoint: string;
  startDate: string;
  endDate: string;
  status: string;
  notes?: string;
}

interface Report {
  bus: {
    busName: string;
    plateNumber: string;
    driverName?: string;
    driverPhone?: string;
    routeName?: string;
    routeDescription?: string;
    capacity: number;
  };
  passengerCount: number;
  capacity: number;
  passengers: Passenger[];
}

export default function TransportPassengersPage() {
  const [buses, setBuses] = useState<BusOption[]>([]);
  const [busId, setBusId] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/transport/meta")
      .then((r) => r.json())
      .then((d) => setBuses(d.buses || []));
  }, []);

  async function loadReport() {
    if (!busId) {
      setError("اختر حافلة أولاً");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/transport/passengers?busId=${busId}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "فشل تحميل القائمة");
      return;
    }
    setReport(data.report);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Title title="قائمة ركاب الحافلة" subtitle="عرض وطباعة قائمة الطلاب المسجلين في كل حافلة" />
        {report && (
          <Button onClick={handlePrint}>طباعة القائمة</Button>
        )}
      </div>
      <div className="print:hidden">
        <TransportNav />
      </div>

      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
        <select className="input-field min-w-[220px]" value={busId} onChange={(e) => setBusId(e.target.value)}>
          <option value="">اختر الحافلة</option>
          {buses.map((b) => (
            <option key={b._id} value={b._id}>
              {b.busName} — {b.routeName} ({b.plateNumber})
            </option>
          ))}
        </select>
        <Button onClick={loadReport} loading={loading}>عرض القائمة</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 print:hidden">{error}</div>
      )}

      {report && (
        <div id="passenger-list" className="print:block">
          <Card className="mb-6 print:border-0 print:shadow-none">
            <div className="mb-6 text-center print:mb-4">
              <h2 className="text-xl font-bold">أكاديمية هيثم — قائمة ركاب الحافلة</h2>
              <p className="mt-2 text-sm text-muted print:text-black">
                {report.bus.busName} | {report.bus.plateNumber} | {report.bus.routeName}
              </p>
              <p className="text-sm text-muted print:text-black">
                السائق: {report.bus.driverName ?? "—"} — {report.bus.driverPhone ?? "—"}
              </p>
              <p className="mt-1 text-sm">
                عدد الركاب: <strong>{report.passengerCount}</strong> / السعة: <strong>{report.capacity}</strong>
              </p>
            </div>

            {report.passengers.length === 0 ? (
              <EmptyState title="لا يوجد ركاب" description="لا يوجد طلاب مسجلون في هذه الحافلة حالياً" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/5 print:bg-gray-100">
                    <tr>
                      <th className="border border-border p-2 text-right">#</th>
                      <th className="border border-border p-2 text-right">الطالب</th>
                      <th className="border border-border p-2 text-right">الهاتف</th>
                      <th className="border border-border p-2 text-right">نقطة الصعود</th>
                      <th className="border border-border p-2 text-right">نقطة النزول</th>
                      <th className="border border-border p-2 text-right">من</th>
                      <th className="border border-border p-2 text-right">إلى</th>
                      <th className="border border-border p-2 text-right">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.passengers.map((p, i) => (
                      <tr key={p._id}>
                        <td className="border border-border p-2">{i + 1}</td>
                        <td className="border border-border p-2">{p.studentId?.name}</td>
                        <td className="border border-border p-2">{p.studentId?.phone}</td>
                        <td className="border border-border p-2">{p.pickupPoint}</td>
                        <td className="border border-border p-2">{p.dropoffPoint}</td>
                        <td className="border border-border p-2">{formatDate(p.startDate)}</td>
                        <td className="border border-border p-2">{formatDate(p.endDate)}</td>
                        <td className="border border-border p-2">
                          {TRANSPORT_STATUS_LABELS[p.status as keyof typeof TRANSPORT_STATUS_LABELS] ?? p.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #passenger-list, #passenger-list * { visibility: visible; }
          #passenger-list { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
