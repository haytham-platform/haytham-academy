import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export interface ICashbox extends Document {
  openingBalance: number;
  currentBalance: number;
  currency: "DZD";
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CashboxSchema = new Schema<ICashbox>(
  {
    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    currency: { type: String, default: "DZD", enum: ["DZD"] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const Cashbox: Model<ICashbox> =
  mongoose.models.Cashbox ?? mongoose.model<ICashbox>("Cashbox", CashboxSchema);

export default Cashbox;
