import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Course from "@/models/Course";
import Enrollment from "@/models/Enrollment";
import ContactMessage from "@/models/ContactMessage";
import { requirePermission } from "@/lib/auth-helpers";
import { successResponse, errorResponse } from "@/lib/api-response";

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
      pendingStudents,
      totalTeachers,
      totalCourses,
      activeCourses,
      newEnrollmentsThisMonth,
      remainingSeatsAgg,
      topCourseAgg,
      topTeacherAgg,
      messagesCount,
      recentEnrollments,
      recentMessages,
    ] = await Promise.all([
      User.countDocuments(studentBase),
      User.countDocuments({ ...studentBase, createdAt: { $gte: monthStart } }),
      User.countDocuments({ ...studentBase, isActive: true }),
      User.countDocuments({ ...studentBase, status: "pending" }),
      Teacher.countDocuments({ deletedAt: null }),
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
        pendingStudents,
        teachers: totalTeachers,
        courses: totalCourses,
        activeCourses,
        newEnrollmentsThisMonth,
        remainingSeats: remainingSeatsAgg[0]?.total ?? 0,
        messages: messagesCount,
        topCourse,
        topTeacher,
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
