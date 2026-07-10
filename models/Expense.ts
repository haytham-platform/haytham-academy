import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type ExpenseCategory =
  | "rent"
  | "salary"
  | "utilities"
  | "marketing"
  | "equipment"
  | "maintenance"
  | "other";

export interface IExpense extends Document {
  expenseNumber: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  expenseDate: Date;
  note?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    title: { type: String, required: true, trim: true },
    expenseNumber: { type: String, required: true, unique: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: {
      type: String,
      enum: [
        "rent",
        "salary",
        "utilities",
        "marketing",
        "equipment",
        "maintenance",
        "other",
      ],
      required: true,
    },
    expenseDate: { type: Date, required: true },
    note: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ExpenseSchema.pre("validate", async function () {
  if (this.expenseNumber) return;
  const date = this.expenseDate ?? new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const count = await Expense.countDocuments({
    expenseDate: { $gte: start, $lte: end },
  });
  this.expenseNumber = `EXP-${datePart}-${String(count + 1).padStart(4, "0")}`;
});

ExpenseSchema.index({ expenseDate: -1 });
ExpenseSchema.index({ category: 1 });

const Expense: Model<IExpense> =
  mongoose.models.Expense ?? mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Expense;
