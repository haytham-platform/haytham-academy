import Enrollment from "@/models/Enrollment";
import Course from "@/models/Course";
import { connectDB } from "@/lib/db";
import type { EnrollmentStatus } from "@/types";

const OCCUPIED_STATUSES: EnrollmentStatus[] = ["pending", "approved"];

export function occupiesSeat(status: EnrollmentStatus): boolean {
  return OCCUPIED_STATUSES.includes(status);
}

export function normalizeEnrollmentStatus(
  status: string
): EnrollmentStatus | null {
  if (status === "accepted") return "approved";
  if (["pending", "approved", "rejected", "cancelled", "suspended", "reactivated", "transferred", "completed", "archived"].includes(status)) {
    return status as EnrollmentStatus;
  }
  return null;
}

export async function countOccupyingEnrollments(courseId: string) {
  return Enrollment.countDocuments({
    course: courseId,
    status: { $in: OCCUPIED_STATUSES },
  });
}

export async function onEnrollmentCreated(
  courseId: string,
  status: EnrollmentStatus
) {
  await applyEnrollmentStatusChange(courseId, "rejected", status);
}

export async function onEnrollmentRemoved(
  courseId: string,
  status: EnrollmentStatus
) {
  await applyEnrollmentStatusChange(courseId, status, "rejected");
}

export async function applyEnrollmentStatusChange(
  courseId: string,
  previousStatus: EnrollmentStatus,
  nextStatus: EnrollmentStatus
) {
  await connectDB();
  const wasOccupying = occupiesSeat(previousStatus);
  const willOccupy = occupiesSeat(nextStatus);

  if (wasOccupying === willOccupy) return;

  const course = await Course.findById(courseId);
  if (!course) throw new Error("الدورة غير موجودة");

  const currentRemaining = course.remainingSeats ?? course.seats;

  if (!wasOccupying && willOccupy) {
    if (currentRemaining <= 0) {
      throw new Error("لا توجد مقاعد متاحة في هذه الدورة");
    }
    course.remainingSeats = currentRemaining - 1;
  } else if (wasOccupying && !willOccupy) {
    course.remainingSeats = Math.min(course.seats, currentRemaining + 1);
  }

  await course.save();
}
