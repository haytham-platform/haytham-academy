export type TransportSubscriptionStatus = "active" | "paused" | "expired";

export const TRANSPORT_STATUS_LABELS: Record<TransportSubscriptionStatus, string> = {
  active: "نشط",
  paused: "موقوف",
  expired: "منتهي",
};

export const BUS_STATUS_LABELS = {
  active: "نشطة",
  inactive: "غير نشطة",
  maintenance: "صيانة",
} as const;

export const DRIVER_STATUS_LABELS = {
  active: "نشط",
  inactive: "غير نشط",
} as const;

export const ROUTE_STATUS_LABELS = {
  active: "نشط",
  inactive: "غير نشط",
} as const;
