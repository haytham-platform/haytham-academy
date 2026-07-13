import mongoose from "mongoose";
import { StudentCharge, StudentDebt, StudentDiscount, StudentPayment, StudentRefund } from "@/models/StudentFinance";
import { requireStudentFinanceReports } from "@/lib/auth-helpers";
import { errorResponse, successResponse } from "@/lib/api-response";
import { buildPaginationMeta, parsePagination } from "@/lib/pagination";
import { connectDB } from "@/lib/db";
import { formatStudentCharge, formatStudentPayment, minorToAmount } from "@/lib/student-finance";

function dateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return Object.keys(range).length ? range : null;
}

export async function GET(request: Request) {
  try {
    const { error } = await requireStudentFinanceReports();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "student_balance";
    const pagination = parsePagination(searchParams, 25);
    const range = dateRange(searchParams);
    await connectDB();

    if (["daily_payments", "weekly_payments", "monthly_payments"].includes(type)) {
      const filter: Record<string, unknown> = { status: { $in: ["completed", "refunded"] } };
      if (range) filter.paymentDate = range;
      const [payments, total] = await Promise.all([
        StudentPayment.find(filter)
          .populate("studentId", "name phone academicLevel")
          .sort({ paymentDate: -1 })
          .skip(pagination.skip)
          .limit(pagination.limit)
          .lean(),
        StudentPayment.countDocuments(filter),
      ]);
      return successResponse({ report: payments.map(formatStudentPayment), pagination: buildPaginationMeta(total, pagination) });
    }

    if (type === "student_balance") {
      const [charges, total] = await Promise.all([
        StudentCharge.find({ status: { $ne: "cancelled" } })
          .populate("studentId", "name phone academicLevel")
          .populate("courseId", "title level")
          .sort({ balanceMinor: -1 })
          .skip(pagination.skip)
          .limit(pagination.limit)
          .lean(),
        StudentCharge.countDocuments({ status: { $ne: "cancelled" } }),
      ]);
      return successResponse({ report: charges.map(formatStudentCharge), pagination: buildPaginationMeta(total, pagination) });
    }

    if (type === "outstanding_debt" || type === "overdue_payments") {
      const [debts, total] = await Promise.all([
        StudentDebt.find({ status: { $in: ["open", "in_collection"] } })
          .populate("studentId", "name phone academicLevel")
          .sort({ originalDueDate: 1 })
          .skip(pagination.skip)
          .limit(pagination.limit)
          .lean(),
        StudentDebt.countDocuments({ status: { $in: ["open", "in_collection"] } }),
      ]);
      return successResponse({
        report: debts.map((debt) => ({
          _id: debt._id.toString(),
          studentId: debt.studentId,
          chargeId: debt.chargeId.toString(),
          outstandingAmount: minorToAmount(debt.outstandingAmountMinor),
          daysOverdue: debt.daysOverdue,
          originalDueDate: debt.originalDueDate,
          status: debt.status,
          collectionNotes: debt.collectionNotes ?? "",
        })),
        pagination: buildPaginationMeta(total, pagination),
      });
    }

    if (type === "discounts") {
      const rows = await StudentDiscount.aggregate([
        { $match: { approvalStatus: "approved" } },
        { $group: { _id: "$type", total: { $sum: "$appliedAmountMinor" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]);
      return successResponse({ report: rows.map((row) => ({ type: row._id, total: minorToAmount(row.total), count: row.count })) });
    }

    if (type === "refunds") {
      const rows = await StudentRefund.aggregate([
        { $match: { status: "processed" } },
        { $group: { _id: "$refundMethod", total: { $sum: "$refundAmountMinor" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]);
      return successResponse({ report: rows.map((row) => ({ refundMethod: row._id, total: minorToAmount(row.total), count: row.count })) });
    }

    if (type === "revenue_by_payment_method") {
      const rows = await StudentPayment.aggregate([
        { $match: { status: { $in: ["completed", "refunded"] } } },
        { $group: { _id: "$paymentMethod", total: { $sum: "$amountMinor" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]);
      return successResponse({ report: rows.map((row) => ({ paymentMethod: row._id, total: minorToAmount(row.total), count: row.count })) });
    }

    if (type === "revenue_by_course") {
      const rows = await StudentCharge.aggregate([
        { $match: { courseId: { $ne: null }, status: { $ne: "cancelled" } } },
        { $group: { _id: "$courseId", total: { $sum: "$paidAmountMinor" }, outstanding: { $sum: "$balanceMinor" } } },
        { $lookup: { from: "courses", localField: "_id", foreignField: "_id", as: "course" } },
        { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
        { $sort: { total: -1 } },
      ]);
      return successResponse({ report: rows.map((row) => ({ courseId: row._id?.toString(), courseTitle: row.course?.title ?? "", total: minorToAmount(row.total), outstanding: minorToAmount(row.outstanding) })) });
    }

    if (type === "revenue_by_academic_level") {
      const rows = await StudentCharge.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "student" } },
        { $unwind: "$student" },
        { $group: { _id: { $ifNull: ["$student.academicLevel", "$student.studyLevel"] }, total: { $sum: "$paidAmountMinor" }, outstanding: { $sum: "$balanceMinor" } } },
        { $sort: { total: -1 } },
      ]);
      return successResponse({ report: rows.map((row) => ({ academicLevel: row._id ?? "", total: minorToAmount(row.total), outstanding: minorToAmount(row.outstanding) })) });
    }

    if (type === "revenue_by_season") {
      const rows = await StudentCharge.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: "$academicSeason", total: { $sum: "$paidAmountMinor" }, outstanding: { $sum: "$balanceMinor" } } },
        { $sort: { _id: -1 } },
      ]);
      return successResponse({ report: rows.map((row) => ({ season: row._id ?? "", total: minorToAmount(row.total), outstanding: minorToAmount(row.outstanding) })) });
    }

    if (type === "student_statement") {
      const studentId = searchParams.get("studentId");
      if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return errorResponse("الطالب مطلوب");
      const charges = await StudentCharge.find({ studentId }).populate("courseId", "title").sort({ dueDate: 1 }).lean();
      const payments = await StudentPayment.find({ studentId }).sort({ paymentDate: -1 }).lean();
      return successResponse({ report: { charges: charges.map(formatStudentCharge), payments: payments.map(formatStudentPayment) } });
    }

    return errorResponse("نوع التقرير غير صالح", 404);
  } catch (err) {
    console.error("Student finance reports GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
