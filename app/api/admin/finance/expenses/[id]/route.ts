import { connectDB } from "@/lib/db";
import Expense from "@/models/Expense";
import { requireFinance } from "@/lib/auth-helpers";
import {
  formatExpense,
  validateAmount,
  validateDate,
} from "@/lib/finance";
import { reverseSourceEntry } from "@/lib/cashbox";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireFinance();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    await connectDB();

    const update: Record<string, unknown> = {};
    if (body.title?.trim()) update.title = body.title.trim();
    if (body.amount !== undefined) {
      const amount = validateAmount(body.amount);
      if (!amount) return errorResponse("المبلغ يجب أن يكون أكبر من صفر");
      update.amount = amount;
    }
    if (body.category) update.category = body.category;
    if (body.expenseDate) {
      const expenseDate = validateDate(body.expenseDate);
      if (!expenseDate) return errorResponse("تاريخ المصروف غير صالح");
      update.expenseDate = expenseDate;
    }
    if (body.note !== undefined) update.note = body.note?.trim() || "";

    const expense = await Expense.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!expense) return errorResponse("المصروف غير موجود", 404);

    return successResponse({
      expense: formatExpense(expense),
    });
  } catch (err) {
    console.error("Finance expense PUT:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireFinance();
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) return errorResponse("المصروف غير موجود", 404);

    await reverseSourceEntry(
      "expense",
      id,
      expense.amount,
      "عكس: حذف مصروف",
      user!._id,
      "out"
    );

    return successResponse({ message: "تم حذف المصروف بنجاح" });
  } catch (err) {
    console.error("Finance expense DELETE:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
