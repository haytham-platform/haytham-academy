import mongoose, { Schema, type Document, type Model } from "mongoose";

export type DriverStatus = "active" | "inactive";

export interface IDriver extends Document {
  name: string;
  phone: string;
  status: DriverStatus;
  notes: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DriverSchema.index({ deletedAt: 1, status: 1 });
DriverSchema.index({ name: 1 });

const Driver: Model<IDriver> =
  mongoose.models.Driver ?? mongoose.model<IDriver>("Driver", DriverSchema);

export default Driver;
