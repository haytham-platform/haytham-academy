export type UserRole =
  | "admin"
  | "deputy"
  | "secretary"
  | "teacher"
  | "student";

export type EnrollmentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "accepted"
  | "suspended"
  | "reactivated"
  | "transferred"
  | "completed"
  | "archived";

export type StudentGender = "male" | "female";

export type StudentStatus = "active" | "pending" | "suspended" | "withdrawn" | "graduated" | "archived";

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship?: string;
}

export interface StudentDocument {
  title: string;
  type: string;
  url: string;
  publicId?: string;
  uploadedAt?: Date | string;
  verificationStatus?: "pending" | "verified" | "rejected" | "expired";
  verifiedBy?: string;
  verifiedAt?: Date | string;
  expiresAt?: Date | string;
  size?: number;
  mimeType?: string;
  notes?: string;
}

export type TeacherStatus = "active" | "on_leave" | "suspended" | "resigned";

export type TeacherEmploymentType = "full_time" | "part_time" | "contract" | "visiting";

export interface TeacherQualification {
  degree: string;
  institution?: string;
  field?: string;
  year?: number;
}

export interface TeacherScheduleItem {
  day: string;
  startTime: string;
  endTime: string;
  className?: string;
  subject?: string;
  room?: string;
}

export interface TeacherAttendanceRecord {
  date: Date | string;
  status: "present" | "absent" | "late" | "excused";
  note?: string;
}

export interface TeacherMoneyRecord {
  title?: string;
  amount: number;
  date: Date | string;
  note?: string;
}

export interface TeacherSalaryConfig {
  type: "fixed" | "hourly" | "per_session";
  baseSalary?: number;
  hourlyRate?: number;
  sessionRate?: number;
  currency?: string;
  effectiveFrom?: Date | string;
}

export interface TeacherContract {
  title: string;
  type?: string;
  status?: "active" | "expired" | "terminated" | "draft";
  startDate?: Date | string;
  endDate?: Date | string;
  url?: string;
  publicId?: string;
  uploadedAt?: Date | string;
}

export interface TeacherDocument {
  title: string;
  type: string;
  url: string;
  publicId?: string;
  uploadedAt?: Date | string;
}

export interface TeacherPerformanceRecord {
  date: Date | string;
  title?: string;
  rating?: number;
  note?: string;
  createdBy?: string;
}

export interface JwtPayload {
  userId: string;
  sessionId: string;
  role: UserRole;
}

export interface ApiError {
  error: string;
}

export interface AcademyInfo {
  name: string;
  nameEn: string;
  phone: string;
  address: string;
}

export interface SafeUser {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StudentProfile {
  gender?: StudentGender;
  dateOfBirth?: Date;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelationship?: string;
  academicLevel?: string;
  className?: string;
  address?: string;
  wilaya?: string;
  commune?: string;
  studyLevel?: string;
  institution?: string;
  notes?: string;
  emergencyContacts?: EmergencyContact[];
  documents?: StudentDocument[];
  deletedAt?: Date | null;
}
