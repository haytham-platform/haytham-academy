import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Course from "@/models/Course";
import Enrollment from "@/models/Enrollment";
import ContactMessage from "@/models/ContactMessage";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getStudentFinanceStats } from "@/lib/student-finance";
import { getPrivateLessonStats } from "@/lib/private-lessons";
import { buildDashboardAnalytics } from "@/lib/reports-analytics";
import AcademicSeason from "@/models/AcademicSeason";
import RolloverJob from "@/models/RolloverJob";
import { communicationDashboardStats } from "@/lib/communications";

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export async function GET() {
  try {
    const { error } = await requirePermission("admin.access");
    if (error) return error;

    await connectDB();

    const monthStart = startOfMonth();
    const studentBase = { role: "student" as const, deletedAt: null };
    const activeCourseFilter = { deletedAt: null, isActive: true };

    const [
      totalStudents,
      newStudentsThisMonth,
      activeStudents,
      suspendedStudents,
      totalTeachers,
      activeTeachers,
      onLeaveTeachers,
      suspendedTeachers,
      totalCourses,
      activeCourses,
      newEnrollmentsThisMonth,
      remainingSeatsAgg,
      topCourseAgg,
      topTeacherAgg,
      messagesCount,
      recentEnrollments,
      recentMessages,
      studentFinanceStats,
      privateLessonStats,
      dashboardAnalytics,
      currentSeason,
      upcomingSeason,
      closedSeasons,
      rolloverProgress,
      archiveTotals,
      communicationStats,
    ] = await Promise.all([
      User.countDocuments(studentBase),
      User.countDocuments({ ...studentBase, createdAt: { $gte: monthStart } }),
      User.countDocuments({ ...studentBase, isActive: true }),
      User.countDocuments({ ...studentBase, status: "suspended" }),
      Teacher.countDocuments({ deletedAt: null }),
      Teacher.countDocuments({ deletedAt: null, status: "active" }),
      Teacher.countDocuments({ deletedAt: null, status: "on_leave" }),
      Teacher.countDocuments({ deletedAt: null, status: "suspended" }),
      Course.countDocuments({ deletedAt: null }),
      Course.countDocuments(activeCourseFilter),
      Enrollment.countDocuments({ createdAt: { $gte: monthStart } }),
      Course.aggregate([
        { $match: activeCourseFilter },
        { $group: { _id: null, total: { $sum: "$remainingSeats" } } },
      ]),
      Enrollment.aggregate([
        { $match: { status: { $in: ["pending", "approved", "accepted"] } } },
        { $group: { _id: "$course", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: "courses",
            localField: "_id",
            foreignField: "_id",
            as: "course",
          },
        },
        { $unwind: "$course" },
      ]),
      Enrollment.aggregate([
        { $match: { status: { $in: ["pending", "approved", "accepted"] } } },
        {
          $lookup: {
            from: "courses",
            localField: "course",
            foreignField: "_id",
            as: "courseDoc",
          },
        },
        { $unwind: "$courseDoc" },
        { $group: { _id: "$courseDoc.teacher", students: { $sum: 1 } } },
        { $sort: { students: -1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: "teachers",
            localField: "_id",
            foreignField: "_id",
            as: "teacher",
          },
        },
        { $unwind: "$teacher" },
      ]),
      ContactMessage.countDocuments(),
      Enrollment.find()
        .populate("student", "name phone")
        .populate("course", "title")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      ContactMessage.find().sort({ createdAt: -1 }).limit(5).lean(),
      getStudentFinanceStats(),
      getPrivateLessonStats(),
      buildDashboardAnalytics(),
      AcademicSeason.findOne({ isCurrent: true }).lean(),
      AcademicSeason.findOne({ status: "upcoming" }).sort({ startDate: 1 }).lean(),
      AcademicSeason.countDocuments({ status: "closed" }),
      RolloverJob.aggregate([{ $group: { _id: "$status", total: { $sum: "$totalStudents" }, completed: { $sum: "$completed" }, failed: { $sum: "$failed" }, jobs: { $sum: 1 } } }]),
      Promise.all([
        AcademicSeason.countDocuments({ status: "archived" }),
        User.countDocuments({ role: "student", $or: [{ deletedAt: { $ne: null } }, { status: "archived" }] }),
        Teacher.countDocuments({ deletedAt: { $ne: null } }),
        Course.countDocuments({ deletedAt: { $ne: null } }),
      ]),
      communicationDashboardStats(),
    ]);

    const topCourse = topCourseAgg[0]
      ? {
          courseId: topCourseAgg[0]._id.toString(),
          title: topCourseAgg[0].course.title,
          enrollments: topCourseAgg[0].count,
        }
      : null;

    const topTeacher = topTeacherAgg[0]
      ? {
          teacherId: topTeacherAgg[0]._id.toString(),
          name: topTeacherAgg[0].teacher.name,
          students: topTeacherAgg[0].students,
        }
      : null;

    return successResponse({
      stats: {
        students: totalStudents,
        newStudentsThisMonth,
        activeStudents,
        suspendedStudents,
        teachers: totalTeachers,
        activeTeachers,
        onLeaveTeachers,
        suspendedTeachers,
        courses: totalCourses,
        activeCourses,
        newEnrollmentsThisMonth,
        remainingSeats: remainingSeatsAgg[0]?.total ?? 0,
        messages: messagesCount,
        topCourse,
        topTeacher,
        studentFinance: studentFinanceStats,
        privateLessons: privateLessonStats,
        analytics: dashboardAnalytics,
        academicSeasons: {
          current: currentSeason,
          upcoming: upcomingSeason,
          closedSeasons,
          rolloverProgress,
          archiveTotals: {
            seasons: archiveTotals[0],
            students: archiveTotals[1],
            teachers: archiveTotals[2],
            courses: archiveTotals[3],
          },
        },
        communications: communicationStats,
      },
      recentEnrollments: recentEnrollments.map((e) => ({
        _id: e._id.toString(),
        student: e.student,
        course: e.course,
        status: String(e.status) === "accepted" ? "approved" : e.status,
        createdAt: e.createdAt,
      })),
      recentMessages: recentMessages.map((m) => ({
        _id: m._id.toString(),
        name: m.name,
        phone: m.phone,
        message: m.message,
        isRead: m.isRead,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
