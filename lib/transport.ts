import type { TransportSubscriptionStatus } from "@/lib/transport-labels";

export function deriveSubscriptionStatus(input: {
  status: TransportSubscriptionStatus;
  startDate: Date;
  endDate: Date;
}): TransportSubscriptionStatus {
  if (input.status === "paused") return "paused";

  const now = new Date();
  const end = new Date(input.endDate);
  end.setHours(23, 59, 59, 999);

  if (now > end) return "expired";
  return "active";
}

export function syncSubscriptionStatus(sub: {
  status: TransportSubscriptionStatus;
  startDate: Date;
  endDate: Date;
}) {
  return {
    status: deriveSubscriptionStatus(sub),
  };
}

export function formatDriver(d: {
  _id: { toString(): string };
  name: string;
  phone: string;
  status: string;
  notes?: string;
  deletedAt?: Date | null;
  createdAt?: Date;
}) {
  return {
    _id: d._id.toString(),
    name: d.name,
    phone: d.phone,
    status: d.status,
    notes: d.notes ?? "",
    deletedAt: d.deletedAt,
    createdAt: d.createdAt,
  };
}

export function formatRoute(r: {
  _id: { toString(): string };
  name: string;
  description?: string;
  status: string;
  notes?: string;
  deletedAt?: Date | null;
  createdAt?: Date;
}) {
  return {
    _id: r._id.toString(),
    name: r.name,
    description: r.description ?? "",
    status: r.status,
    notes: r.notes ?? "",
    deletedAt: r.deletedAt,
    createdAt: r.createdAt,
  };
}

export function formatBus(b: {
  _id: { toString(): string };
  busName: string;
  plateNumber: string;
  driverId?: unknown;
  routeId?: unknown;
  capacity: number;
  status: string;
  notes?: string;
  deletedAt?: Date | null;
  createdAt?: Date;
}) {
  const driver = b.driverId as { _id?: { toString(): string }; name?: string; phone?: string } | null;
  const route = b.routeId as { _id?: { toString(): string }; name?: string; description?: string } | null;

  return {
    _id: b._id.toString(),
    busName: b.busName,
    plateNumber: b.plateNumber,
    driverId: driver?._id?.toString?.() ?? b.driverId,
    routeId: route?._id?.toString?.() ?? b.routeId,
    driverName: driver?.name,
    driverPhone: driver?.phone,
    routeName: route?.name,
    routeDescription: route?.description ?? "",
    capacity: b.capacity,
    status: b.status,
    notes: b.notes ?? "",
    deletedAt: b.deletedAt,
    createdAt: b.createdAt,
  };
}

export function formatSubscription(s: {
  _id: { toString(): string };
  studentId: unknown;
  busId: unknown;
  startDate: Date;
  endDate: Date;
  status: string;
  pickupPoint: string;
  dropoffPoint: string;
  notes?: string;
  createdAt?: Date;
}) {
  return {
    _id: s._id.toString(),
    studentId: s.studentId,
    busId: s.busId,
    startDate: s.startDate,
    endDate: s.endDate,
    status: s.status,
    pickupPoint: s.pickupPoint,
    dropoffPoint: s.dropoffPoint,
    notes: s.notes ?? "",
    createdAt: s.createdAt,
  };
}

export type { TransportSubscriptionStatus } from "@/lib/transport-labels";
export {
  TRANSPORT_STATUS_LABELS,
  BUS_STATUS_LABELS,
  DRIVER_STATUS_LABELS,
  ROUTE_STATUS_LABELS,
} from "@/lib/transport-labels";

export function toCsv(headers: string[], rows: string[][]): string {
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

export function csvResponse(filename: string, content: string) {
  return new Response("\uFEFF" + content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
