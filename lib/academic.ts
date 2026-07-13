import type {
  EmergencyContact,
  EnrollmentStatus,
  StudentDocument,
  StudentGender,
  StudentStatus,
  TeacherAttendanceRecord,
  TeacherContract,
  TeacherDocument,
  TeacherEmploymentType,
  TeacherMoneyRecord,
  TeacherPerformanceRecord,
  TeacherQualification,
  TeacherSalaryConfig,
  TeacherScheduleItem,
  TeacherStatus,
} from "@/types";

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
  guardianRelationship?: string;
  address?: string;
  wilaya?: string;
  commune?: string;
  academicLevel?: string;
  className?: string;
  studyLevel?: string;
  institution?: string;
  notes?: string;
  emergencyContacts?: EmergencyContact[];
  documents?: StudentDocument[];
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
    status: s.status ?? (s.isActive ? "active" : "suspended"),
    gender: s.gender,
    dateOfBirth: s.dateOfBirth,
    guardianName: s.guardianName,
    guardianPhone: s.guardianPhone,
    guardianRelationship: s.guardianRelationship,
    address: s.address,
    wilaya: s.wilaya,
    commune: s.commune,
    academicLevel: s.academicLevel ?? s.studyLevel,
    className: s.className,
    studyLevel: s.studyLevel,
    institution: s.institution,
    notes: s.notes ?? "",
    emergencyContacts: s.emergencyContacts ?? [],
    documents: s.documents ?? [],
    deletedAt: s.deletedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function formatTeacherQualification(item: TeacherQualification): TeacherQualification {
  return {
    degree: item.degree,
    institution: item.institution,
    field: item.field,
    year: item.year,
  };
}

function formatTeacherScheduleItem(item: TeacherScheduleItem): TeacherScheduleItem {
  return {
    day: item.day,
    startTime: item.startTime,
    endTime: item.endTime,
    className: item.className,
    subject: item.subject,
    room: item.room,
  };
}

function formatTeacherAttendanceRecord(item: TeacherAttendanceRecord): TeacherAttendanceRecord {
  return {
    date: item.date,
    status: item.status,
    note: item.note,
  };
}

function formatTeacherMoneyRecord(item: TeacherMoneyRecord): TeacherMoneyRecord {
  return {
    title: item.title,
    amount: item.amount,
    date: item.date,
    note: item.note,
  };
}

function formatTeacherSalaryConfig(config?: TeacherSalaryConfig): TeacherSalaryConfig {
  return {
    type: config?.type ?? "per_session",
    baseSalary: config?.baseSalary,
    hourlyRate: config?.hourlyRate,
    sessionRate: config?.sessionRate,
    currency: config?.currency ?? "DZD",
    effectiveFrom: config?.effectiveFrom,
  };
}

function formatTeacherContract(item: TeacherContract): TeacherContract {
  return {
    title: item.title,
    type: item.type,
    status: item.status,
    startDate: item.startDate,
    endDate: item.endDate,
    url: item.url,
    publicId: item.publicId,
    uploadedAt: item.uploadedAt,
  };
}

function formatTeacherDocument(item: TeacherDocument): TeacherDocument {
  return {
    title: item.title,
    type: item.type,
    url: item.url,
    publicId: item.publicId,
    uploadedAt: item.uploadedAt,
  };
}

function formatTeacherPerformanceRecord(item: TeacherPerformanceRecord): TeacherPerformanceRecord {
  return {
    date: item.date,
    title: item.title,
    rating: item.rating,
    note: item.note,
    createdBy: item.createdBy,
  };
}

export function formatTeacher(t: {
  _id: { toString(): string };
  name: string;
  subject: string;
  phone: string;
  teachingLevel?: string;
  email?: string;
  address?: string;
  nationalId?: string;
  emergencyPhone?: string;
  hireDate?: Date;
  employmentType?: TeacherEmploymentType;
  status?: TeacherStatus;
  qualifications?: TeacherQualification[];
  subjects?: string[];
  academicLevels?: string[];
  assignedClasses?: string[];
  weeklySchedule?: TeacherScheduleItem[];
  attendance?: TeacherAttendanceRecord[];
  salaryConfig?: TeacherSalaryConfig;
  salaryHistory?: TeacherMoneyRecord[];
  bonuses?: TeacherMoneyRecord[];
  deductions?: TeacherMoneyRecord[];
  contracts?: TeacherContract[];
  documents?: TeacherDocument[];
  notes?: string;
  performanceRecords?: TeacherPerformanceRecord[];
  adminShare?: number;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const adminShare = t.adminShare;
  const teacherShare =
    adminShare !== undefined && adminShare !== null ? 100 - adminShare : undefined;
  const subjects = t.subjects?.length ? t.subjects : [t.subject].filter(Boolean);
  const academicLevels = t.academicLevels?.length
    ? t.academicLevels
    : [t.teachingLevel ?? ""].filter(Boolean);
  const status = t.status ?? (t.isActive ? "active" : "suspended");

  return {
    _id: t._id.toString(),
    name: t.name,
    subject: t.subject,
    phone: t.phone,
    teachingLevel: t.teachingLevel ?? "",
    email: t.email ?? "",
    address: t.address ?? "",
    nationalId: t.nationalId ?? "",
    emergencyPhone: t.emergencyPhone ?? "",
    hireDate: t.hireDate,
    employmentType: t.employmentType ?? "part_time",
    status,
    qualifications: (t.qualifications ?? []).map(formatTeacherQualification),
    subjects,
    academicLevels,
    assignedClasses: t.assignedClasses ?? [],
    weeklySchedule: (t.weeklySchedule ?? []).map(formatTeacherScheduleItem),
    attendance: (t.attendance ?? []).map(formatTeacherAttendanceRecord),
    salaryConfig: formatTeacherSalaryConfig(t.salaryConfig),
    salaryHistory: (t.salaryHistory ?? []).map(formatTeacherMoneyRecord),
    bonuses: (t.bonuses ?? []).map(formatTeacherMoneyRecord),
    deductions: (t.deductions ?? []).map(formatTeacherMoneyRecord),
    contracts: (t.contracts ?? []).map(formatTeacherContract),
    documents: (t.documents ?? []).map(formatTeacherDocument),
    notes: t.notes ?? "",
    performanceRecords: (t.performanceRecords ?? []).map(formatTeacherPerformanceRecord),
    adminShare,
    teacherShare,
    isActive: t.isActive,
    deletedAt: t.deletedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
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
