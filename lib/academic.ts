import type { EnrollmentStatus, StudentGender, StudentStatus } from "@/types";

export function notDeletedFilter(includeDeleted?: boolean) {
  if (includeDeleted) return {};
  return { deletedAt: null };
}

export function formatStudent(s: {
  _id: { toString(): string };
  name: string;
  phone?: string;
  role: string;
  isActive: boolean;
  status?: StudentStatus;
  gender?: StudentGender;
  dateOfBirth?: Date;
  guardianName?: string;
  guardianPhone?: string;
  address?: string;
  wilaya?: string;
  commune?: string;
  studyLevel?: string;
  institution?: string;
  notes?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt?: Date;
}) {
  return {
    _id: s._id.toString(),
    name: s.name,
    phone: s.phone,
    role: s.role,
    isActive: s.isActive,
    status: s.status ?? (s.isActive ? "active" : "inactive"),
    gender: s.gender,
    dateOfBirth: s.dateOfBirth,
    guardianName: s.guardianName,
    guardianPhone: s.guardianPhone,
    address: s.address,
    wilaya: s.wilaya,
    commune: s.commune,
    studyLevel: s.studyLevel,
    institution: s.institution,
    notes: s.notes ?? "",
    deletedAt: s.deletedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export function formatTeacher(t: {
  _id: { toString(): string };
  name: string;
  subject: string;
  phone: string;
  teachingLevel?: string;
  adminShare?: number;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
}) {
  const adminShare = t.adminShare;
  const teacherShare =
    adminShare !== undefined && adminShare !== null ? 100 - adminShare : undefined;

  return {
    _id: t._id.toString(),
    name: t.name,
    subject: t.subject,
    phone: t.phone,
    teachingLevel: t.teachingLevel ?? "",
    adminShare,
    teacherShare,
    isActive: t.isActive,
    deletedAt: t.deletedAt,
    createdAt: t.createdAt,
  };
}

export function formatCourse(c: {
  _id: { toString(): string };
  title: string;
  description: string;
  teacher: unknown;
  department?: string;
  price: number;
  image?: string;
  level: string;
  duration: string;
  startDate: Date;
  endDate?: Date;
  studyDays?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  color?: string;
  seats: number;
  remainingSeats?: number;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
}) {
  return {
    _id: c._id.toString(),
    title: c.title,
    description: c.description,
    teacher: c.teacher,
    department: c.department ?? "",
    price: c.price,
    image: c.image ?? "",
    level: c.level,
    duration: c.duration,
    startDate: c.startDate,
    endDate: c.endDate,
    studyDays: c.studyDays ?? "",
    startTime: c.startTime ?? "",
    endTime: c.endTime ?? "",
    room: c.room ?? "",
    color: c.color ?? "#6366f1",
    seats: c.seats,
    remainingSeats: c.remainingSeats ?? c.seats,
    isActive: c.isActive,
    deletedAt: c.deletedAt,
    createdAt: c.createdAt,
  };
}

export function formatEnrollmentStatus(status: string): EnrollmentStatus {
  if (status === "accepted") return "approved";
  return status as EnrollmentStatus;
}

export function formatEnrollment(e: {
  _id: { toString(): string };
  student: unknown;
  course: unknown;
  status: string;
  note?: string;
  createdBy?: unknown;
  createdAt: Date;
  updatedAt?: Date;
}) {
  return {
    _id: e._id.toString(),
    student: e.student,
    course: e.course,
    status: formatEnrollmentStatus(e.status),
    note: e.note ?? "",
    createdBy: e.createdBy,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

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
