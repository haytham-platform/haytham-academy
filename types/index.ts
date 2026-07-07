export type UserRole =
  | "admin"
  | "deputy"
  | "secretary"
  | "teacher"
  | "student";

export type EnrollmentStatus = "pending" | "approved" | "rejected" | "cancelled";

export type StudentGender = "male" | "female";

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
  address?: string;
  wilaya?: string;
  commune?: string;
  studyLevel?: string;
  institution?: string;
  notes?: string;
  deletedAt?: Date | null;
}
