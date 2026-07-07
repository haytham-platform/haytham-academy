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

ExpenseSchema.index({ expenseDate: -1 });
ExpenseSchema.index({ category: 1 });

const Expense: Model<IExpense> =
  mongoose.models.Expense ?? mongoose.model<IExpense>("Expense", ExpenseSchema);

export default Expense;
