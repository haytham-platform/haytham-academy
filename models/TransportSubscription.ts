import mongoose, { Schema, type Document, type Model, Types } from "mongoose";

export type TransportSubscriptionStatus = "active" | "paused" | "expired";

export interface ITransportSubscription extends Document {
  studentId: Types.ObjectId;
  busId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  status: TransportSubscriptionStatus;
  pickupPoint: string;
  dropoffPoint: string;
  notes: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TransportSubscriptionSchema = new Schema<ITransportSubscription>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    busId: { type: Schema.Types.ObjectId, ref: "Bus", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "paused", "expired"],
      default: "active",
    },
    pickupPoint: { type: String, required: true, trim: true },
    dropoffPoint: { type: String, required: true, trim: true },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

TransportSubscriptionSchema.index({ studentId: 1, status: 1 });
TransportSubscriptionSchema.index({ busId: 1, status: 1 });
TransportSubscriptionSchema.index({ endDate: 1 });

if (process.env.NODE_ENV === "development" && mongoose.models.TransportSubscription) {
  delete mongoose.models.TransportSubscription;
}

const TransportSubscription: Model<ITransportSubscription> =
  mongoose.models.TransportSubscription ??
  mongoose.model<ITransportSubscription>(
    "TransportSubscription",
    TransportSubscriptionSchema
  );

export default TransportSubscription;
