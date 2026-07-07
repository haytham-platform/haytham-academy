import type { EnrollmentStatus } from "@/types";

const statusLabels: Record<EnrollmentStatus, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
  cancelled: "ملغى",
};

const statusClasses: Record<EnrollmentStatus, string> = {
  pending: "badge-pending",
  approved: "badge-accepted",
  rejected: "badge-rejected",
  cancelled: "badge-inactive",
};

export default function StatusBadge({ status }: { status: EnrollmentStatus | string }) {
  const normalized =
    status === "accepted" ? "approved" : (status as EnrollmentStatus);
  return (
    <span className={`badge ${statusClasses[normalized] ?? "badge-pending"}`}>
      {statusLabels[normalized] ?? status}
    </span>
  );
}
