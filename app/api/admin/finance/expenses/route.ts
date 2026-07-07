import { connectDB } from "@/lib/db";
import Expense from "@/models/Expense";
import { requireFinance } from "@/lib/auth-helpers";
import {
  formatExpense,
  validateAmount,
  validateDate,
} from "@/lib/finance";
import { recordExpenseOut } from "@/lib/cashbox";
import { successResponse, errorResponse } from "@/lib/api-response";

const CATEGORIES = [
  "rent",
  "salary",
  "utilities",
  "marketing",
  "equipment",
  "maintenance",
  "other",
];

export async function GET(request: Request) {
  try {
    const { error } = await requireFinance();
    if (error) return error;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const filter: Record<string, unknown> = {};
    const category = searchParams.get("category");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (category) filter.category = category;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      filter.expenseDate = dateFilter;
    }

    const expenses = await Expense.find(filter).sort({ expenseDate: -1 }).lean();

    return successResponse({
      expenses: expenses.map((e) => formatExpense(e)),
    });
  } catch (err) {
    console.error("Finance expenses GET:", err);
    return errorResponse("حدث خطأ", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { user, error } = await requireFinance();
    if (error) return error;

    const body = await request.json();
    const amount = validateAmount(body.amount);
    const expenseDate = validateDate(body.expenseDate);

    if (!body.title?.trim()) return errorResponse("عنوان المصروف مطلوب");
    if (!amount) return errorResponse("المبلغ يجب أن يكون أكبر من صفر");
    if (!expenseDate) return errorResponse("تاريخ المصروف غير صالح");
    if (!CATEGORIES.includes(body.category)) {
      return errorResponse("تصنيف المصروف غير صالح");
    }

    await connectDB();

    const expense = await Expense.create({
      title: body.title.trim(),
      amount,
      category: body.category,
      expenseDate,
      note: body.note?.trim() || "",
      createdBy: user!._id,
    });

    await recordExpenseOut(
      expense._id.toString(),
      amount,
      `مصروف: ${body.title.trim()}`,
      user!._id
    );

    return successResponse(
      { expense: formatExpense(expense.toObject()) },
      201
    );
  } catch (err) {
    console.error("Finance expenses POST:", err);
    return errorResponse("حدث خطأ", 500);
  }
}
