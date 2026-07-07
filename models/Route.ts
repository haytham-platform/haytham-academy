import mongoose, { Schema, type Document, type Model } from "mongoose";

export type RouteStatus = "active" | "inactive";

export interface IRoute extends Document {
  name: string;
  description: string;
  status: RouteStatus;
  notes: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RouteSchema = new Schema<IRoute>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RouteSchema.index({ deletedAt: 1, status: 1 });
RouteSchema.index({ name: 1 });

const RouteModel: Model<IRoute> =
  mongoose.models.TransportRoute ?? mongoose.model<IRoute>("TransportRoute", RouteSchema);

export default RouteModel;
