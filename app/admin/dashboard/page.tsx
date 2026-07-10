import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Users,
  GraduationCap,
  BookOpen,
  MessageSquare,
  UserPlus,
  Armchair,
  TrendingUp,
  Clock,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Teacher from "@/models/Teacher";
import Course from "@/models/Course";
import ContactMessage from "@/models/ContactMessage";
import Enrollment from "@/models/Enrollment";
import Title from "@/components/ui/Title";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StatusBadge from "@/components/ui/StatusBadge";
import type { EnrollmentStatus } from "@/types";

export const metadata: Metadata = {
  title: "لوحة الإدارة",
};

export const dynamic = "force-dynamic";

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) redirect("/login");

  await connectDB();

  const monthStart = startOfMonth();
  const studentBase = { role: "student" as const, deletedAt: null };
  const activeCourseFilter = { deletedAt: null, isActive: true };

  const [
    totalStudents,
    newStudentsThisMonth,
    activeStudents,
    pendingStudents,
    teachersCount,
    coursesCount,
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
      {
        $group: {
          _id: null,
          total: {
            $sum: { $ifNull: ["$remainingSeats", "$seats"] },
          },
        },
      },
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

  const remainingSeats = remainingSeatsAgg[0]?.total ?? 0;
  const topCourse = topCourseAgg[0];
  const topTeacher = topTeacherAgg[0];

  const stats = [
    { label: "إجمالي الطلاب", value: totalStudents, icon: Users, color: "bg-blue-500" },
    { label: "طلاب جدد (الشهر)", value: newStudentsThisMonth, icon: UserPlus, color: "bg-cyan-500" },
    { label: "الطلاب النشطون", value: activeStudents, icon: TrendingUp, color: "bg-emerald-500" },
    { label: "طلاب قيد الانتظار", value: pendingStudents, icon: Clock, color: "bg-amber-500" },
    { label: "إجمالي الأساتذة", value: teachersCount, icon: GraduationCap, color: "bg-sky-500" },
    { label: "إجمالي الدورات", value: coursesCount, icon: BookOpen, color: "bg-indigo-500" },
    { label: "الدورات النشطة", value: activeCourses, icon: BookOpen, color: "bg-violet-500" },
    { label: "تسجيلات جديدة", value: newEnrollmentsThisMonth, icon: UserPlus, color: "bg-pink-500" },
    { label: "المقاعد المتبقية", value: remainingSeats, icon: Armchair, color: "bg-amber-500" },
    { label: "الرسائل", value: messagesCount, icon: MessageSquare, color: "bg-orange-500" },
  ];

  return (
    <div>
      <Title
        title="لوحة التحكم"
        subtitle={`مرحباً ${user.name} — إحصائيات الأكاديمية`}
        className="mb-8"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-1 text-3xl font-bold">{value}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color} text-white`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 font-bold">أكثر دورة تسجيلاً</h3>
          {topCourse ? (
            <p className="text-sm">
              {topCourse.course.title} — <strong>{topCourse.count}</strong> تسجيل
            </p>
          ) : (
            <p className="text-sm text-muted">لا توجد بيانات</p>
          )}
        </Card>
        <Card>
          <h3 className="mb-2 font-bold">أكثر أستاذ لديه طلاب</h3>
          {topTeacher ? (
            <p className="text-sm">
              {topTeacher.teacher.name} — <strong>{topTeacher.students}</strong> طالب
            </p>
          ) : (
            <p className="text-sm text-muted">لا توجد بيانات</p>
          )}
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-bold">آخر التسجيلات</h2>
          {recentEnrollments.length > 0 ? (
            <div className="space-y-3">
              {recentEnrollments.map((e) => (
                <div
                  key={e._id.toString()}
                  className="flex items-center justify-between rounded-xl border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {(e.student as { name?: string })?.name}
                    </p>
                    <p className="text-xs text-muted">
                      {(e.course as { title?: string })?.title}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      String(e.status) === "accepted"
                        ? "approved"
                        : (e.status as EnrollmentStatus)
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">لا توجد تسجيلات</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-bold">آخر الرسائل</h2>
          {recentMessages.length > 0 ? (
            <div className="space-y-3">
              {recentMessages.map((m) => (
                <div key={m._id.toString()} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{m.name}</p>
                    {!m.isRead && <Badge variant="warning">جديدة</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{m.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">لا توجد رسائل</p>
          )}
        </Card>
      </div>
    </div>
  );
}
