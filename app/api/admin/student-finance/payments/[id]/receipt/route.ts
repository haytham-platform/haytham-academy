import mongoose from "mongoose";
import { errorResponse, successResponse } from "@/lib/api-response";
import { recordFinancialAudit } from "@/lib/audit";
import { requireStudentFinanceView } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/db";
import { buildStudentFinancialProfile, minorToAmount } from "@/lib/student-finance";
import { StudentCharge, StudentPayment } from "@/models/StudentFinance";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireStudentFinanceView();
    if (error) return error;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse("Invalid payment id", 400);
    }

    await connectDB();
    const payment = await StudentPayment.findById(id)
      .populate("studentId", "name phone academicLevel className")
      .populate("receivedBy", "name")
      .lean();

    if (!payment) {
      return errorResponse("Payment not found", 404);
    }

    const allocationIds = payment.allocations.map((allocation) => allocation.chargeId);
    const charges = await StudentCharge.find({ _id: { $in: allocationIds } })
      .populate("courseId", "title")
      .lean();
    const profile = await buildStudentFinancialProfile(payment.studentId._id?.toString?.() ?? payment.studentId.toString());
    const chargeById = new Map(charges.map((charge) => [charge._id.toString(), charge]));
    const student = payment.studentId as unknown as {
      _id: mongoose.Types.ObjectId;
      name?: string;
      phone?: string;
      academicLevel?: string;
      className?: string;
    };
    const receivedBy = payment.receivedBy as unknown as { name?: string } | undefined;

    const receipt = {
      receiptNumber: payment.receiptNumber,
      paymentId: payment._id.toString(),
      student: {
        id: student._id?.toString?.() ?? payment.studentId.toString(),
        name: student.name ?? "",
        code: student.phone ?? "",
        academicLevel: student.academicLevel ?? "",
        className: student.className ?? "",
      },
      payment: {
        amount: minorToAmount(payment.amountMinor),
        method: payment.paymentMethod,
        reference: payment.paymentReference ?? "",
        status: payment.status,
        date: payment.paymentDate.toISOString(),
        academicSeason: payment.academicSeason ?? "",
        notes: payment.notes ?? "",
        receivedBy: receivedBy?.name ?? "",
      },
      allocations: payment.allocations.map((allocation) => {
        const charge = chargeById.get(allocation.chargeId.toString());
        const course = charge?.courseId as unknown as { title?: string } | undefined;
        return {
          chargeId: allocation.chargeId.toString(),
          description: charge?.description ?? "",
          courseTitle: course?.title ?? "",
          amount: minorToAmount(allocation.amountMinor),
        };
      }),
      remainingBalance: profile.remainingBalance,
      issuedAt: new Date().toISOString(),
    };

    const { searchParams } = new URL(request.url);
    if (searchParams.get("reprint") === "true") {
      await recordFinancialAudit({
        userId: user!._id,
        action: "student_receipt.reprint",
        recordType: "student_payment",
        recordId: payment._id.toString(),
        metadata: { receiptNumber: payment.receiptNumber },
      });
    }

    return successResponse({ receipt });
  } catch (err) {
    console.error("Student payment receipt:", err);
    return errorResponse(err instanceof Error ? err.message : "حدث خطأ", 400);
  }
}
