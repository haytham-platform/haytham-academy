import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type BusStatus = "active" | "inactive" | "maintenance";

export interface IBus extends Document {
  busName: string;
  plateNumber: string;
  driverId: Types.ObjectId;
  routeId: Types.ObjectId;
  capacity: number;
  status: BusStatus;
  notes: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BusSchema = new Schema<IBus>(
  {
    busName: { type: String, required: true, trim: true },
    plateNumber: { type: String, required: true, trim: true, unique: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
    routeId: { type: Schema.Types.ObjectId, ref: "TransportRoute", required: true },
    capacity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active",
    },
    notes: { type: String, default: "", trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

BusSchema.index({ deletedAt: 1, status: 1 });

if (process.env.NODE_ENV === "development" && mongoose.models.Bus) {
  delete mongoose.models.Bus;
}

const Bus: Model<IBus> =
  mongoose.models.Bus ?? mongoose.model<IBus>("Bus", BusSchema);

export default Bus;
